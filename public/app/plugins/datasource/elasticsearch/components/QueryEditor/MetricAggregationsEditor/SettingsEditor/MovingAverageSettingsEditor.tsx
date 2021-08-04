import { Input, InlineField, Select, InlineSwitch } from '@grafana/ui';
import React from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { movingAvgModelOptions } from '../../../../query_def';
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

  return (
    <>
      <InlineField label="Model" labelWidth={16}>
        <Select
          menuShouldPortal
          onChange={(value) => dispatch(changeMetricSetting(metric, 'model', value.value!))}
          options={movingAvgModelOptions}
          value={metric.settings?.model}
        />
      </InlineField>

      <SettingField label="Window" settingName="window" metric={metric} placeholder="5" />

      <SettingField label="Predict" settingName="predict" metric={metric} />

      {(isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (
        <InlineField label="Alpha" labelWidth={16}>
          <Input
            onBlur={(e) =>
              dispatch(
                changeMetricSetting(metric, 'settings', {
                  ...metric.settings?.settings,
                  alpha: e.target.value,
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
            onBlur={(e) =>
              dispatch(
                changeMetricSetting(metric, 'settings', {
                  ...metric.settings?.settings,
                  beta: e.target.value,
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
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    gamma: e.target.value,
                  })
                )
              }
              defaultValue={metric.settings?.settings?.gamma}
            />
          </InlineField>
          <InlineField label="Period" labelWidth={16}>
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    period: e.target.value!,
                  })
                )
              }
              defaultValue={metric.settings?.settings?.period}
            />
          </InlineField>

          <InlineField label="Pad" labelWidth={16}>
            <InlineSwitch
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', { ...metric.settings?.settings, pad: e.target.checked })
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              dispatch(changeMetricSetting(metric, 'minimize', e.target.checked))
            }
            checked={!!metric.settings?.minimize}
          />
        </InlineField>
      )}
    </>
  );
};
