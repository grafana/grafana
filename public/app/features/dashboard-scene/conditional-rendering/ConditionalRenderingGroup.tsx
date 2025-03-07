import { css } from '@emotion/css';
import { Fragment, ReactNode, useMemo } from 'react';

import { dateTime, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Divider, Dropdown, Field, Menu, RadioButtonGroup, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingAfter } from './ConditionalRenderingAfter';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingBefore } from './ConditionalRenderingBefore';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

type Value = Array<
  | ConditionalRenderingData
  | ConditionalRenderingAfter
  | ConditionalRenderingBefore
  | ConditionalRenderingVariable
  | ConditionalRenderingGroup
>;

export interface ConditionalRenderingGroupState extends ConditionalRenderingBaseState<Value> {
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

  public addItem(
    item:
      | ConditionalRenderingData
      | ConditionalRenderingAfter
      | ConditionalRenderingBefore
      | ConditionalRenderingVariable
      | ConditionalRenderingGroup
  ) {
    this.changeValue([...this.state.value, item]);
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({ condition: 'and', value: [] });
  }

  public onDelete() {
    const rootGroup = this.getRootGroup();
    if (this === rootGroup) {
      this.getBehavior().setState({ rootGroup: ConditionalRenderingGroup.createEmpty() });
    } else {
      rootGroup.setState({ value: rootGroup.state.value.filter((condition) => condition !== this) });
    }
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

  const currentConditionOption = useMemo(
    () => conditionsOptions.find((option) => option.value === condition)!,
    [conditionsOptions, condition]
  );

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <Field label={t('dashboard.conditional-rendering.group.condition.label', 'Evaluate conditions')}>
        <RadioButtonGroup
          fullWidth
          options={conditionsOptions}
          value={currentConditionOption.value}
          onChange={(value) => model.changeCondition(value!)}
        />
      </Field>

      <Divider spacing={1} />

      {value.map((entry) => (
        <Fragment key={entry!.state.key}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */}
          <entry.Component model={entry as any} />

          <div className={styles.entryDivider}>
            <Divider spacing={1} />
            <p className={styles.entryDividerText}> {currentConditionOption.value}</p>
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
                label={t('dashboard.conditional-rendering.group.add.from', 'From')}
                onClick={() => model.addItem(new ConditionalRenderingAfter({ value: dateTime() }))}
              />
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.to', 'To')}
                onClick={() => model.addItem(new ConditionalRenderingBefore({ value: dateTime() }))}
              />
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.variable', 'Variable value')}
                onClick={() => model.addItem(new ConditionalRenderingVariable({ value: { name: '', values: [] } }))}
              />
              {/* <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.between', 'Between')}
                onClick={() =>
                  model.addItem(
                    new ConditionalRenderingGroup({
                      condition: 'and',
                      value: [
                        new ConditionalRenderingAfter({ value: dateTime() }),
                        new ConditionalRenderingBefore({ value: dateTime() }),
                      ],
                    })
                  )
                }
              />
              <Menu.Item
                label={t('dashboard.conditional-rendering.group.add.group', 'Group')}
                onClick={() => model.addItem(ConditionalRenderingGroup.createEmpty())}
              /> */}
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
