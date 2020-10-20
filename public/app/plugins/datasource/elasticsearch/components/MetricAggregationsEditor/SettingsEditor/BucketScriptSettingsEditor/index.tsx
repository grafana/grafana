import React, { Fragment, FunctionComponent } from 'react';
import { Input, InlineField, InlineLabel } from '@grafana/ui';
import { useDispatch } from '../../../ElasticsearchQueryContext';
import { BucketScript, MetricAggregation, MetricAggregationAction } from '../../state/types';
import { changeMetricAttribute, changeMetricSetting } from '../../state/actions';
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
                  className={css`
                    white-space: nowrap;
                  `}
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

      <InlineField
        labelWidth={16}
        label="Script"
        tooltip="Elasticsearch v5.0 and above: Scripting language is Painless. Use params.<var> to reference a variable.
Elasticsearch pre-v5.0: Scripting language is per default Groovy if not changed. For Groovy use <var> to reference a variable. "
      >
        <Input
          placeholder="pars.var1 / params.var2"
          onBlur={e => upperStateDispatch(changeMetricSetting(value, 'script', e.target.value))}
          defaultValue={value.settings?.script}
        />
      </InlineField>
    </>
  );
};
