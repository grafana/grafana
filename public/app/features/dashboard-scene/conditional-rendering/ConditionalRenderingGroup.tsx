import { css } from '@emotion/css';
import { Fragment, ReactNode, useMemo } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Combobox, ComboboxOption, Divider, Field, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingConditions } from './shared';

export type GroupConditionValue = ConditionalRenderingConditions[];
export interface ConditionalRenderingGroupState extends ConditionalRenderingBaseState<GroupConditionValue> {
  condition: 'and' | 'or';
}

export class ConditionalRenderingGroup extends ConditionalRenderingBase<ConditionalRenderingGroupState> {
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

  const conditionsOptions: Array<ComboboxOption<'and' | 'or'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.condition.meet-all', 'All conditions are met'), value: 'and' },
      { label: t('dashboard.conditional-rendering.group.condition.meet-any', 'Any condition is met'), value: 'or' },
    ],
    []
  );

  return (
    <Stack direction="column">
      {value.length > 1 ? (
        <>
          <Field
            label={t('dashboard.conditional-rendering.group.condition.label', 'Apply if')}
            className={styles.field}
          >
            <Combobox
              options={conditionsOptions}
              value={condition}
              onChange={({ value }) => model.changeCondition(value!)}
            />
          </Field>

          <Divider spacing={1} />
        </>
      ) : null}

      {value.map((entry) => (
        <Fragment key={entry!.state.key}>
          {/* @ts-expect-error */}
          <entry.Component model={entry} />

          <Divider spacing={1} />
        </Fragment>
      ))}
    </Stack>
  );
}

const getStyles = () => ({
  field: css({
    margin: 0,
  }),
});
