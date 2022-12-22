import { uniqueId } from 'lodash';
import React, { useRef } from 'react';

import { Input, InlineField, Select, InlineSwitch } from '@grafana/ui';

import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { movingAvgModelOptions } from '../../../../queryDef';
import { isEWMAMovingAverage, isHoltMovingAverage, isHoltWintersMovingAverage, MovingAverage } from '../aggregations';
import { changeMetricSetting } from '../state/actions';

import { SettingField } from './SettingField';

interface Props {
  metric: MovingAverage;
}

// The way we handle changes for those settings is not ideal compared to the other components in the editor
// FIXME: using `changeMetricSetting` will cause an error when switching from models that have different options
// as they might be incompatible. We should clear all other options on model change.
export const MovingAverageSettingsEditor = ({ metric }: Props) => {
  const dispatch = useDispatch();
  const { current: baseId } = useRef(uniqueId('es-moving-avg-'));

  return (
    <>
      <InlineField label="Model" labelWidth={16}>
        <Select
          inputId={`${baseId}-model`}
          onChange={(value) => dispatch(changeMetricSetting({ metric, settingName: 'model', newValue: value.value }))}
          options={movingAvgModelOptions}
          value={metric.settings?.model}
        />
      </InlineField>

      <SettingField label="Window" settingName="window" metric={metric} placeholder="5" />

      <SettingField label="Predict" settingName="predict" metric={metric} />

      {(isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (
        <InlineField label="Alpha" labelWidth={16}>
          <Input
            id={`${baseId}-alpha`}
            onBlur={(e) =>
              dispatch(
                changeMetricSetting({
                  metric,
                  settingName: 'settings',
                  newValue: {
                    ...metric.settings?.settings,
                    alpha: e.target.value,
                  },
                })
              )
            }
            defaultValue={metric.settings?.settings?.alpha}
          />
        </InlineField>
      )}

      {(isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (
        <InlineField label="Beta" labelWidth={16}>
          <Input
            id={`${baseId}-beta`}
            onBlur={(e) =>
              dispatch(
                changeMetricSetting({
                  metric,
                  settingName: 'settings',
                  newValue: {
                    ...metric.settings?.settings,
                    beta: e.target.value,
                  },
                })
              )
            }
            defaultValue={metric.settings?.settings?.beta}
          />
        </InlineField>
      )}

      {isHoltWintersMovingAverage(metric) && (
        <>
          <InlineField label="Gamma" labelWidth={16}>
            <Input
              id={`${baseId}-gamma`}
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting({
                    metric,
                    settingName: 'settings',
                    newValue: {
                      ...metric.settings?.settings,
                      gamma: e.target.value,
                    },
                  })
                )
              }
              defaultValue={metric.settings?.settings?.gamma}
            />
          </InlineField>
          <InlineField label="Period" labelWidth={16}>
            <Input
              id={`${baseId}-period`}
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting({
                    metric,
                    settingName: 'settings',
                    newValue: {
                      ...metric.settings?.settings,
                      period: e.target.value!,
                    },
                  })
                )
              }
              defaultValue={metric.settings?.settings?.period}
            />
          </InlineField>

          <InlineField label="Pad" labelWidth={16}>
            <InlineSwitch
              id={`${baseId}-pad`}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(
                  changeMetricSetting({
                    metric,
                    settingName: 'settings',
                    newValue: { ...metric.settings?.settings, pad: e.target.checked },
                  })
                )
              }
              checked={!!metric.settings?.settings?.pad}
            />
          </InlineField>
        </>
      )}

      {(isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (
        <InlineField label="Minimize" labelWidth={16}>
          <InlineSwitch
            id={`${baseId}-minimize`}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              dispatch(changeMetricSetting({ metric, settingName: 'minimize', newValue: e.target.checked }))
            }
            checked={!!metric.settings?.minimize}
          />
        </InlineField>
      )}
    </>
  );
};
