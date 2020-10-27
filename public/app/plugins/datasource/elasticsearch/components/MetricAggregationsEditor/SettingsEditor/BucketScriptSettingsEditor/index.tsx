import React, { Fragment, FunctionComponent } from 'react';
import { Input, InlineLabel } from '@grafana/ui';
import { useDispatch } from '../../../ElasticsearchQueryContext';
import { BucketScript, MetricAggregation, MetricAggregationAction } from '../../state/types';
import { changeMetricAttribute } from '../../state/actions';
import { css } from 'emotion';
import { AddRemove } from '../../../AddRemove';
import { useReducerCallback } from '../../../../hooks/useReducerCallback';
import { MetricPicker } from '../../../MetricPicker';
import { defaultPipelineVariable } from './utils';
import pipelineVariablesReducer from './state/reducer';
import {
  addPipelineVariable,
  removePipelineVariable,
  renamePipelineVariable,
  changePipelineVariableMetric,
} from './state/action';
import { SettingField } from '../SettingField';

interface Props {
  value: BucketScript;
  previousMetrics: MetricAggregation[];
}

export const BucketScriptSettingsEditor: FunctionComponent<Props> = ({ value, previousMetrics }) => {
  const upperStateDispatch = useDispatch<MetricAggregationAction<BucketScript>>();

  const dispatch = useReducerCallback(
    newState => upperStateDispatch(changeMetricAttribute(value, 'pipelineVariables', newState)),
    value.pipelineVariables || [],
    pipelineVariablesReducer
  );

  return (
    <>
      <div
        className={css`
          display: flex;
        `}
      >
        <InlineLabel width={16}>Variables</InlineLabel>
        <div
          className={css`
            display: grid;
            grid-template-columns: 1fr auto;
            row-gap: 4px;
            margin-bottom: 4px;
          `}
        >
          {(value.pipelineVariables || [defaultPipelineVariable()]).map((pipelineVar, index) => (
            <Fragment key={pipelineVar.name}>
              <div
                className={css`
                  display: grid;
                  column-gap: 4px;
                  grid-template-columns: auto auto;
                `}
              >
                <Input
                  defaultValue={pipelineVar.name}
                  placeholder="Variable Name"
                  onBlur={e => dispatch(renamePipelineVariable(e.target.value, index))}
                />
                <MetricPicker
                  onChange={e => dispatch(changePipelineVariableMetric(e.value!.id, index))}
                  options={previousMetrics}
                  value={pipelineVar.pipelineAgg}
                />
              </div>

              <AddRemove
                index={index}
                elements={value.pipelineVariables || []}
                onAdd={() => dispatch(addPipelineVariable())}
                onRemove={() => dispatch(removePipelineVariable(index))}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <SettingField
        label="Script"
        metric={value}
        settingName="script"
        // TODO: This should be better formatted.
        tooltip="Elasticsearch v5.0 and above: Scripting language is Painless. Use params.<var> to reference a variable. Elasticsearch pre-v5.0: Scripting language is per default Groovy if not changed. For Groovy use <var> to reference a variable."
        placeholder="params.var1 / params.var2"
      />
    </>
  );
};
