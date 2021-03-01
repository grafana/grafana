import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { Input, InlineLabel } from '@grafana/ui';
import { MetricAggregationAction } from '../../state/types';
import { changeMetricAttribute } from '../../state/actions';
import { css } from 'emotion';
import { AddRemove } from '../../../../AddRemove';
import { useStatelessReducer, useDispatch } from '../../../../../hooks/useStatelessReducer';
import { MetricPicker } from '../../../../MetricPicker';
import { reducer } from './state/reducer';
import {
  addPipelineVariable,
  removePipelineVariable,
  renamePipelineVariable,
  changePipelineVariableMetric,
} from './state/actions';
import { SettingField } from '../SettingField';
import { BucketScript, MetricAggregation } from '../../aggregations';

interface Props {
  value: BucketScript;
  previousMetrics: MetricAggregation[];
}

export const BucketScriptSettingsEditor: FunctionComponent<Props> = ({ value, previousMetrics }) => {
  const upperStateDispatch = useDispatch<MetricAggregationAction<BucketScript>>();

  const dispatch = useStatelessReducer(
    (newState) => upperStateDispatch(changeMetricAttribute(value, 'pipelineVariables', newState)),
    value.pipelineVariables,
    reducer
  );

  // The model might not have pipeline variables (or an empty array of pipeline vars) in it because of the way it was built in previous versions of the datasource.
  // If this is the case we add a default one.
  useEffect(() => {
    if (!value.pipelineVariables?.length) {
      dispatch(addPipelineVariable());
    }
  }, []);

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
          {value.pipelineVariables!.map((pipelineVar, index) => (
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
                  onBlur={(e) => dispatch(renamePipelineVariable(e.target.value, index))}
                />
                <MetricPicker
                  onChange={(e) => dispatch(changePipelineVariableMetric(e.value!.id, index))}
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
        tooltip="Elasticsearch v5.0 and above: Scripting language is Painless. Use params.<var> to reference a variable. Elasticsearch pre-v5.0: Scripting language is per default Groovy if not changed. For Groovy use <var> to reference a variable."
        placeholder="params.var1 / params.var2"
      />
    </>
  );
};
