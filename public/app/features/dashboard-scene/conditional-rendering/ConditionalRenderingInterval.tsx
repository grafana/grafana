import { ReactNode, useState } from 'react';

import { rangeUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingTimeIntervalKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Field, Input, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

export type IntervalConditionValue = string;
type ConditionalRenderingIntervalState = ConditionalRenderingBaseState<IntervalConditionValue>;

export class ConditionalRenderingInterval extends ConditionalRenderingBase<ConditionalRenderingIntervalState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.interval.label', 'Time range interval');
  }

  public constructor(state: ConditionalRenderingIntervalState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.getConditionalLogicRoot().notifyChange();
      })
    );
  }

  public evaluate(): boolean {
    try {
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

  public render(): ReactNode {
    return <ConditionalRenderingIntervalRenderer model={this} />;
  }

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }

  public serialize(): ConditionalRenderingTimeIntervalKind {
    return {
      kind: 'ConditionalRenderingTimeInterval',
      spec: {
        value: this.state.value,
      },
    };
  }
}

function ConditionalRenderingIntervalRenderer({ model }: SceneComponentProps<ConditionalRenderingInterval>) {
  const { value } = model.useState();
  const [isValid, setIsValid] = useState(validateIntervalRegex.test(value));

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <Field
        invalid={!isValid}
        error={t('dashboard.conditional-rendering.interval.invalid-message', 'Invalid interval')}
        label={t('dashboard.conditional-rendering.interval.input-label', 'Value')}
      >
        <Input
          value={value}
          onChange={(e) => {
            setIsValid(validateIntervalRegex.test(e.currentTarget.value));
            model.setStateAndNotify({ value: e.currentTarget.value });
          }}
        />
      </Field>
    </Stack>
  );
}

export const validateIntervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])?$/;
