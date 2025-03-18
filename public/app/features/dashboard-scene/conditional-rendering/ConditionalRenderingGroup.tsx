import { css } from '@emotion/css';
import { Fragment, ReactNode, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Divider, Dropdown, Field, Menu, RadioButtonGroup, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingInterval } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { ConditionalRenderingConditions } from './shared';

export type GroupConditionValue = ConditionalRenderingConditions[];
export interface ConditionalRenderingGroupState extends ConditionalRenderingBaseState<GroupConditionValue> {
  condition: 'and' | 'or';
}

export class ConditionalRenderingGroup extends ConditionalRenderingBase<ConditionalRenderingGroupState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.group.label', 'Group');
  }

  public evaluate(): boolean {
    if (this.state.value.length === 0) {
      return true;
    }

    if (this.state.condition === 'and') {
      return this.state.value.every((entry) => entry.evaluate());
    }

    return this.state.value.some((entry) => entry.evaluate());
  }

  public render(): ReactNode {
    return <ConditionalRenderingGroupRenderer model={this} />;
  }

  public changeCondition(condition: 'and' | 'or') {
    this.setStateAndNotify({ condition });
  }

  public addItem(item: ConditionalRenderingConditions) {
    // We don't use `setStateAndNotify` here because
    // We need to set a parent and activate the new condition before notifying the root
    this.setState({ value: [...this.state.value, item] });

    if (this.isActive && !item.isActive) {
      item.activate();
    }

    this.getConditionalLogicRoot().notifyChange();
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({ condition: 'and', value: [] });
  }

  public onDelete() {
    const rootGroup = this.getRootGroup();
    if (this === rootGroup) {
      this.getConditionalLogicRoot().setState({ rootGroup: ConditionalRenderingGroup.createEmpty() });
    } else {
      rootGroup.setState({ value: rootGroup.state.value.filter((condition) => condition !== this) });
    }
    this.getConditionalLogicRoot().notifyChange();
  }

  public serialize(): ConditionalRenderingGroupKind {
    if (this.state.value.some((item) => item instanceof ConditionalRenderingGroup)) {
      throw new Error('ConditionalRenderingGroup cannot contain nested ConditionalRenderingGroups');
    }
    return {
      kind: 'ConditionalRenderingGroup',
      spec: {
        condition: this.state.condition,
        items: this.state.value
          .map((condition) => condition.serialize())
          .filter((item) => item.kind !== 'ConditionalRenderingGroup'),
      },
    };
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const styles = useStyles2(getStyles);
  const { condition, value } = model.useState();

  const conditionsOptions: Array<SelectableValue<'and' | 'or'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.condition.meet-all', 'Meet all'), value: 'and' },
      { label: t('dashboard.conditional-rendering.group.condition.meet-any', 'Meet any'), value: 'or' },
    ],
    []
  );

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <Field label={t('dashboard.conditional-rendering.group.condition.label', 'Evaluate conditions')}>
        <RadioButtonGroup
          fullWidth
          options={conditionsOptions}
          value={condition}
          onChange={(value) => model.changeCondition(value!)}
        />
      </Field>

      <Divider spacing={1} />

      {value.map((entry) => (
        <Fragment key={entry!.state.key}>
          {/* @ts-expect-error */}
          <entry.Component model={entry} />

          <div className={styles.entryDivider}>
            <Divider spacing={1} />
            <p className={styles.entryDividerText}> {condition}</p>
            <Divider spacing={1} />
          </div>
        </Fragment>
      ))}

      <div className={styles.addButtonContainer}>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.data', 'Data')}
                onClick={() => model.addItem(new ConditionalRenderingData({ value: true }))}
              />
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.interval', 'Interval')}
                onClick={() => model.addItem(new ConditionalRenderingInterval({ value: '7d' }))}
              />
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.variable', 'Variable value')}
                onClick={() =>
                  model.addItem(new ConditionalRenderingVariable({ value: { name: '', operator: '=', value: '' } }))
                }
              />
            </Menu>
          }
        >
          <ToolbarButton icon="plus" iconSize="xs" variant="canvas">
            <Trans i18nKey="dashboard.conditional-rendering.group.add.button">Add condition based on</Trans>
          </ToolbarButton>
        </Dropdown>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  entryDivider: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  entryDividerText: css({
    margin: 0,
    padding: theme.spacing(0, 2),
    textTransform: 'capitalize',
  }),
  addButtonContainer: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  }),
});
