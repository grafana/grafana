import { Input, InlineField, Select, Switch } from '@grafana/ui';
import React, { FunctionComponent } from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { movingAvgModelOptions } from '../../../../query_def';
import { isEWMAMovingAverage, isHoltMovingAverage, isHoltWintersMovingAverage, MovingAverage } from '../aggregations';
import { changeMetricSetting } from '../state/actions';

interface Props {
  metric: MovingAverage;
}

// The way we handle changes for those settings is not ideal compared to the other components in the editor
export const MovingAverageSettingsEditor: FunctionComponent<Props> = ({ metric }) => {
  const dispatch = useDispatch();

  return (
    <>
      <InlineField label="Model">
        <Select
          onChange={(value) => dispatch(changeMetricSetting(metric, 'model', value.value!))}
          options={movingAvgModelOptions}
          value={metric.settings?.model}
        />
      </InlineField>

      <InlineField label="Window">
        <Input
          onBlur={(e) => dispatch(changeMetricSetting(metric, 'window', parseInt(e.target.value!, 10)))}
          defaultValue={metric.settings?.window}
        />
      </InlineField>

      <InlineField label="Predict">
        <Input
          onBlur={(e) => dispatch(changeMetricSetting(metric, 'predict', parseInt(e.target.value!, 10)))}
          defaultValue={metric.settings?.predict}
        />
      </InlineField>

      {isEWMAMovingAverage(metric) && (
        <>
          <InlineField label="Alpha">
            <Input
              onBlur={(e) => dispatch(changeMetricSetting(metric, 'alpha', parseInt(e.target.value!, 10)))}
              defaultValue={metric.settings?.alpha}
            />
          </InlineField>

          <InlineField label="Minimize">
            <Switch
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(changeMetricSetting(metric, 'minimize', e.target.checked))
              }
              checked={!!metric.settings?.minimize}
            />
          </InlineField>
        </>
      )}

      {isHoltMovingAverage(metric) && (
        <>
          <InlineField label="Alpha">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    alpha: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.alpha}
            />
          </InlineField>
          <InlineField label="Beta">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    beta: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.beta}
            />
          </InlineField>

          <InlineField label="Minimize">
            <Switch
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(changeMetricSetting(metric, 'minimize', e.target.checked))
              }
              checked={!!metric.settings?.minimize}
            />
          </InlineField>
        </>
      )}

      {isHoltWintersMovingAverage(metric) && (
        <>
          <InlineField label="Alpha">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    alpha: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.alpha}
            />
          </InlineField>
          <InlineField label="Beta">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    beta: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.beta}
            />
          </InlineField>
          <InlineField label="Gamma">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    gamma: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.gamma}
            />
          </InlineField>
          <InlineField label="Period">
            <Input
              onBlur={(e) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', {
                    ...metric.settings?.settings,
                    period: parseInt(e.target.value!, 10),
                  })
                )
              }
              defaultValue={metric.settings?.settings?.period}
            />
          </InlineField>

          <InlineField label="Pad">
            <Switch
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(
                  changeMetricSetting(metric, 'settings', { ...metric.settings?.settings, pad: e.target.checked })
                )
              }
              checked={!!metric.settings?.settings?.pad}
            />
          </InlineField>

          <InlineField label="Minimize">
            <Switch
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(changeMetricSetting(metric, 'minimize', e.target.checked))
              }
              checked={!!metric.settings?.minimize}
            />
          </InlineField>
        </>
      )}
    </>
  );
};
