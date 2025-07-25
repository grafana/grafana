import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { rangeUtil, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingTimeRangeSizeKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Field, Select, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingSerializerRegistryItem, TimeRangeSizeConditionValue } from './types';
import { translatedItemType } from './utils';

type ConditionalRenderingTimeRangeSizeState = ConditionalRenderingBaseState<TimeRangeSizeConditionValue>;

export class ConditionalRenderingTimeRangeSize extends ConditionalRenderingBase<ConditionalRenderingTimeRangeSizeState> {
  public static Component = ConditionalRenderingTimeRangeSizeRenderer;

  public static serializer: ConditionalRenderingSerializerRegistryItem = {
    id: 'ConditionalRenderingTimeRangeSize',
    name: 'Time Range Size',
    deserialize: this.deserialize,
  };

  public get title(): string {
    return t('dashboard.conditional-rendering.conditions.time-range-size.label', 'Time range less than');
  }

  public get info(): string {
    return t(
      'dashboard.conditional-rendering.conditions.time-range-size.info',
      'Show or hide the {{type}} if the dashboard time range is shorter than the selected time frame.',
      { type: translatedItemType(this.getItemType()) }
    );
  }

  public constructor(state: ConditionalRenderingTimeRangeSizeState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(sceneGraph.getTimeRange(this).subscribeToState(() => this.notifyChange()));
  }

  public evaluate(): boolean {
    try {
      if (!validateIntervalRegex.test(this.state.value)) {
        return true;
      }

      const interval = rangeUtil.intervalToSeconds(this.state.value);
      const timeRange = sceneGraph.getTimeRange(this);

      if (timeRange.state.value.to.unix() - timeRange.state.value.from.unix() <= interval) {
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  public serialize(): ConditionalRenderingTimeRangeSizeKind {
    return { kind: 'ConditionalRenderingTimeRangeSize', spec: { value: this.state.value } };
  }

  public static deserialize(model: ConditionalRenderingTimeRangeSizeKind): ConditionalRenderingTimeRangeSize {
    return new ConditionalRenderingTimeRangeSize({ value: model.spec.value });
  }

  public static createEmpty(): ConditionalRenderingTimeRangeSize {
    return new ConditionalRenderingTimeRangeSize({ value: '7d' });
  }
}

function ConditionalRenderingTimeRangeSizeRenderer({ model }: SceneComponentProps<ConditionalRenderingTimeRangeSize>) {
  const { value } = model.useState();
  const [isValid, setIsValid] = useState(validateIntervalRegex.test(value));
  const styles = useStyles2(getStyles);

  useEffect(() => setIsValid(validateIntervalRegex.test(value)), [value]);

  const staticOptions = useMemo<Array<SelectableValue<string>>>(
    () => [
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.minutes', '{{value}} minutes', {
          value: 5,
        }),
        value: '5m',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.minutes', '{{value}} minutes', {
          value: 15,
        }),
        value: '15m',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.minutes', '{{value}} minutes', {
          value: 30,
        }),
        value: '30m',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.hour', '{{value}} hour', {
          value: 1,
        }),
        value: '1h',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
          value: 3,
        }),
        value: '3h',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
          value: 6,
        }),
        value: '6h',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
          value: 12,
        }),
        value: '12h',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.hours', '{{value}} hours', {
          value: 24,
        }),
        value: '24h',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
          value: 2,
        }),
        value: '2d',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
          value: 7,
        }),
        value: '7d',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
          value: 30,
        }),
        value: '30d',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.days', '{{value}} days', {
          value: 90,
        }),
        value: '90d',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.months', '{{value}} months', {
          value: 6,
        }),
        value: '6M',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.year', '{{value}} year', {
          value: 1,
        }),
        value: '1y',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.years', '{{value}} years', {
          value: 2,
        }),
        value: '2y',
      },
      {
        label: t('dashboard.conditional-rendering.conditions.time-range-size.values.years', '{{value}} years', {
          value: 5,
        }),
        value: '5y',
      },
    ],
    []
  );

  const options = useMemo(() => {
    if (staticOptions.find((option) => option.value === value)) {
      return staticOptions;
    }

    return [{ label: value, value }, ...staticOptions];
  }, [staticOptions, value]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      dashboardEditActions.edit({
        description: t('dashboard.edit-actions.edit-time-range-rule', 'Change time range rule'),
        source: model,
        perform: () => model.setStateAndNotify({ value: newValue }),
        undo: () => model.setStateAndNotify({ value }),
      });
    },
    [model, value]
  );

  return (
    <Field
      invalid={!isValid}
      error={t('dashboard.conditional-rendering.conditions.time-range-size.invalid-message', 'Invalid interval')}
      className={styles.container}
    >
      <Select
        isClearable={false}
        allowCustomValue
        onCreateOption={(value) => handleChange(value)}
        value={value}
        options={options}
        onChange={({ value }) => handleChange(value)}
      />
    </Field>
  );
}

const getStyles = () => ({
  container: css({
    margin: 0,
  }),
});

const validateIntervalRegex = /^(\d+(?:\.\d+)?)[Mwdhmsy]$/;
