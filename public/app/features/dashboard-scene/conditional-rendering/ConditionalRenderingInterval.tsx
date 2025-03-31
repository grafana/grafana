import { css } from '@emotion/css';
import { useState } from 'react';

import { rangeUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingTimeIntervalKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Field, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';

export type IntervalConditionValue = string;

type ConditionalRenderingIntervalState = ConditionalRenderingBaseState<IntervalConditionValue>;

export class ConditionalRenderingInterval extends ConditionalRenderingBase<ConditionalRenderingIntervalState> {
  public static Component = ConditionalRenderingIntervalRenderer;

  public get title(): string {
    return t('dashboard.conditional-rendering.interval.label', 'Dashboard time range less than');
  }

  public constructor(state: ConditionalRenderingIntervalState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(sceneGraph.getTimeRange(this).subscribeToState(() => this.notifyChange()));
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
  const styles = useStyles2(getStyles);

  return (
    <Field
      invalid={!isValid}
      error={t('dashboard.conditional-rendering.interval.invalid-message', 'Invalid interval')}
      className={styles.container}
    >
      <Input
        value={value}
        onChange={(e) => {
          setIsValid(validateIntervalRegex.test(e.currentTarget.value));
          model.setStateAndNotify({ value: e.currentTarget.value });
        }}
      />
    </Field>
  );
}

const getStyles = () => ({
  container: css({
    margin: 0,
  }),
});

const validateIntervalRegex = /^(\d+(?:\.\d+)?)(ms|[Mwdhmsy])?$/;
