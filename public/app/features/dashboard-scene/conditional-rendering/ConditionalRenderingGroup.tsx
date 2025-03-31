import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Button, Field, RadioButtonGroup, Select, Stack, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingInterval } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { ConditionalRenderingConditions } from './shared';

export type GroupConditionValue = ConditionalRenderingConditions[];

export interface ConditionalRenderingGroupState extends ConditionalRenderingBaseState<GroupConditionValue> {
  outcome: 'show' | 'hide';
  condition: 'and' | 'or';
}

export class ConditionalRenderingGroup extends ConditionalRenderingBase<ConditionalRenderingGroupState> {
  public static Component = ConditionalRenderingGroupRenderer;

  public get title(): string {
    return t('dashboard.conditional-rendering.group.label', 'Group');
  }

  public evaluate(): boolean {
    if (this.state.value.length === 0) {
      return true;
    }

    const value =
      this.state.condition === 'and'
        ? this.state.value.every((entry) => entry.evaluate())
        : this.state.value.some((entry) => entry.evaluate());

    return this.state.outcome === 'show' ? value : !value;
  }

  public changeOutcome(outcome: 'show' | 'hide') {
    this.setStateAndNotify({ outcome });
  }

  public changeCondition(condition: 'and' | 'or') {
    this.setStateAndNotify({ condition });
  }

  public addItem(itemType: 'data' | 'variable' | 'interval') {
    const item =
      itemType === 'data'
        ? new ConditionalRenderingData({ value: true })
        : itemType === 'variable'
          ? new ConditionalRenderingVariable({
              value: { name: sceneGraph.getVariables(this).state.variables[0].state.name, operator: '=', value: '' },
            })
          : new ConditionalRenderingInterval({ value: '7d' });

    // We don't use `setStateAndNotify` here because
    // We need to set a parent and activate the new condition before notifying the root
    this.setState({ value: [...this.state.value, item] });

    if (this.isActive && !item.isActive) {
      item.activate();
    }

    this.notifyChange();
  }

  public removeItem(key: string) {
    this.setStateAndNotify({ value: this.state.value.filter((condition) => condition.state.key !== key) });
  }

  public serialize(): ConditionalRenderingGroupKind {
    if (this.state.value.some((item) => item instanceof ConditionalRenderingGroup)) {
      throw new Error('ConditionalRenderingGroup cannot contain nested ConditionalRenderingGroups');
    }

    return {
      kind: 'ConditionalRenderingGroup',
      spec: {
        outcome: this.state.outcome,
        condition: this.state.condition,
        items: this.state.value
          .map((condition) => condition.serialize())
          .filter((item) => item.kind !== 'ConditionalRenderingGroup'),
      },
    };
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({ condition: 'and', outcome: 'show', value: [] });
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const styles = useStyles2(getStyles);
  const { condition, outcome, value } = model.useState();

  const [viewNewRule, setViewNewRule] = useState(false);

  useEffect(() => setViewNewRule(false), [value]);

  const outcomeOptions: Array<SelectableValue<'show' | 'hide'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.outcome.show', 'Show'), value: 'show' },
      { label: t('dashboard.conditional-rendering.group.outcome.hide', 'Hide'), value: 'hide' },
    ],
    []
  );

  const conditionsOptions: Array<SelectableValue<'and' | 'or'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.condition.all', 'And'), value: 'and' },
      { label: t('dashboard.conditional-rendering.group.condition.any', 'Or'), value: 'or' },
    ],
    []
  );

  const variables = sceneGraph.getVariables(model).state.variables;

  const newRuleOptions: Array<SelectableValue<'data' | 'variable' | 'interval'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.add.data', 'Query result'), value: 'data' },
      {
        label: t('dashboard.conditional-rendering.group.add.variable', 'Template variable'),
        value: 'variable',
        isDisabled: variables.length === 0,
      },
      {
        label: t('dashboard.conditional-rendering.group.add.interval', 'Dashboard time range less than'),
        value: 'interval',
      },
    ],
    [variables]
  );

  return (
    <Stack direction="column" gap={2}>
      <Field label={t('dashboard.conditional-rendering.group.outcome.label', 'Rules outcome')} className={styles.field}>
        <RadioButtonGroup
          fullWidth
          options={outcomeOptions}
          value={outcome}
          onChange={(value) => model.changeOutcome(value!)}
        />
      </Field>

      <Field label={t('dashboard.conditional-rendering.group.condition.label', 'Match rules')} className={styles.field}>
        <RadioButtonGroup
          fullWidth
          options={conditionsOptions}
          value={condition}
          onChange={(value) => model.changeCondition(value!)}
        />
      </Field>

      <Stack direction="column" gap={2}>
        {value.map((entry) => entry.render())}

        {viewNewRule ? (
          <Select
            allowCustomValue={false}
            placeholder={t('dashboard.conditional-rendering.group.add.placeholder', 'Select rule type')}
            options={newRuleOptions}
            onChange={({ value }) => model.addItem(value!)}
          />
        ) : null}
      </Stack>

      <div className={styles.addButtonContainer}>
        <Button icon="plus" variant="secondary" size="sm" fullWidth onClick={() => setViewNewRule(true)}>
          <Trans i18nKey="dashboard.conditional-rendering.group.add.button">Add rule</Trans>
        </Button>
      </div>
    </Stack>
  );
}

const getStyles = () => ({
  field: css({
    margin: 0,
  }),
  addButtonContainer: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
});
