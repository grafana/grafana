import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';

import { rangeUtil, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingTimeRangeSizeKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Field, Select } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { getLowerTranslatedObjectType } from '../object';

import { ConditionalRenderingConditionWrapper } from './ConditionalRenderingConditionWrapper';
import { ConditionalRenderingConditionsSerializerRegistryItem } from './serializers';
import { checkGroup, getObjectType } from './utils';

interface ConditionalRenderingTimeRangeSizeState extends SceneObjectState {
  value: string;
  result: boolean | undefined;
}

export class ConditionalRenderingTimeRangeSize extends SceneObjectBase<ConditionalRenderingTimeRangeSizeState> {
  public static Component = ConditionalRenderingTimeRangeSizeRenderer;

  public static serializer: ConditionalRenderingConditionsSerializerRegistryItem = {
    id: 'ConditionalRenderingTimeRangeSize',
    name: 'Time Range Size',
    deserialize: this.deserialize,
  };

  public readonly renderHidden = false;

  public readonly validateIntervalRegex = /^(\d+(?:\.\d+)?)[Mwdhmsy]$/;

  public constructor(state: ConditionalRenderingTimeRangeSizeState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });

    this._check();

    this._subs.add(sceneGraph.getTimeRange(this).subscribeToState(() => this._check()));
  }

  private _check() {
    const result = this._evaluate();

    if (result !== this.state.result) {
      this.setState({ ...this.state, result });
      checkGroup(this);
    }

    return result;
  }

  private _evaluate(): boolean | undefined {
    try {
      if (!this.validateIntervalRegex.test(this.state.value)) {
        return undefined;
      }

      const interval = rangeUtil.intervalToSeconds(this.state.value);
      const timeRange = sceneGraph.getTimeRange(this);

      return timeRange.state.value.to.unix() - timeRange.state.value.from.unix() <= interval;
    } catch {
      return undefined;
    }
  }

  public changeValue(value: string) {
    if (this.state.value !== value) {
      this.setState({ value });
      this._check();
    }
  }

  public render(): ReactElement {
    return <this.Component model={this} key={this.state.key} />;
  }

  public serialize(): ConditionalRenderingTimeRangeSizeKind {
    return { kind: 'ConditionalRenderingTimeRangeSize', spec: { value: this.state.value } };
  }

  public static deserialize(model: ConditionalRenderingTimeRangeSizeKind): ConditionalRenderingTimeRangeSize {
    return new ConditionalRenderingTimeRangeSize({ value: model.spec.value, result: undefined });
  }

  public static createEmpty(): ConditionalRenderingTimeRangeSize {
    return new ConditionalRenderingTimeRangeSize({ value: '7d', result: undefined });
  }
}

function ConditionalRenderingTimeRangeSizeRenderer({ model }: SceneComponentProps<ConditionalRenderingTimeRangeSize>) {
  const { value } = model.useState();
  const [isValid, setIsValid] = useState(model.validateIntervalRegex.test(value));

  useEffect(() => setIsValid(model.validateIntervalRegex.test(value)), [model, value]);

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
        perform: () => model.changeValue(newValue ?? ''),
        undo: () => model.changeValue(value),
      });
    },
    [model, value]
  );

  return (
    <ConditionalRenderingConditionWrapper
      info={t(
        'dashboard.conditional-rendering.conditions.time-range-size.info',
        'Show or hide the {{type}} if the dashboard time range is shorter than the selected time frame.',
        { type: getLowerTranslatedObjectType(getObjectType(model)) }
      )}
      isObjectSupported={true}
      model={model}
      title={t('dashboard.conditional-rendering.conditions.time-range-size.label', 'Time range less than')}
    >
      <Field
        invalid={!isValid}
        error={t('dashboard.conditional-rendering.conditions.time-range-size.invalid-message', 'Invalid interval')}
        noMargin
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
    </ConditionalRenderingConditionWrapper>
  );
}
