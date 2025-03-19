import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, VariableDependencyConfig } from '@grafana/scenes';
import { ConditionalRenderingVariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { showConditionalRenderingVariableEditor } from './ConditionalRenderingVariableEditor';
import { DeleteConditionButton } from './DeleteConditionButton';
import { handleDeleteNonGroupCondition } from './shared';

export type VariableConditionValueOperator = '=' | '!=';

export interface VariableConditionValue {
  name: string;
  operator: VariableConditionValueOperator;
  value: string;
}

type ConditionalRenderingVariableState = ConditionalRenderingBaseState<VariableConditionValue>;

export class ConditionalRenderingVariable extends ConditionalRenderingBase<ConditionalRenderingVariableState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (v) => {
      if (v.state.name === this.state.value.name) {
        this.getConditionalLogicRoot().notifyChange();
      }
    },
  });

  public evaluate(): boolean {
    if (!this.state.value.name) {
      return true;
    }

    const variable = sceneGraph.getVariables(this).state.variables.find((v) => v.state.name === this.state.value.name);

    // name is defined but no variable found - return false
    if (!variable) {
      return false;
    }
    const value = variable.getValue();

    let hit = Array.isArray(value) ? value.includes(this.state.value.value) : value === this.state.value.value;

    if (this.state.value.operator === '!=') {
      hit = !hit;
    }

    return hit;
  }

  public render(): ReactNode {
    return <ConditionalRenderingVariableRenderer model={this} />;
  }

  public serialize(): ConditionalRenderingVariableKind {
    return {
      kind: 'ConditionalRenderingVariable',
      spec: {
        variable: this.state.value.name,
        operator: this.state.value.operator === '=' ? 'equals' : 'notEquals',
        value: this.state.value.value,
      },
    };
  }

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }
}

function ConditionalRenderingVariableRenderer({ model }: SceneComponentProps<ConditionalRenderingVariable>) {
  const styles = useStyles2(getStyles);
  const {
    value: { name, operator, value },
  } = model.useState();

  return (
    <div className={styles.card}>
      <div className={styles.cardLeft}>
        <div>{operator}</div>
        <div className={styles.values}>
          <div className={styles.value}>
            {t('dashboard.conditional-rendering.variable.card.name', 'Variable: {{name}}', { name })}
          </div>
          <div className={styles.value}>
            {t('dashboard.conditional-rendering.variable.card.value', 'Value: {{value}}', { value })}
          </div>
        </div>
      </div>

      <div className={styles.cardRight}>
        <IconButton
          name="pen"
          aria-label={t('dashboard.conditional-rendering.variable.card.edit', 'Edit')}
          onClick={() =>
            showConditionalRenderingVariableEditor(model, {
              defaultValues: { name, operator, value },
              onSave: (name: string, operator: VariableConditionValueOperator, value: string) => {
                model.setStateAndNotify({ value: { name, operator, value } });
              },
            })
          }
        />

        <DeleteConditionButton model={model} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    backgroundColor: theme.colors.background.elevated,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1),
    gap: theme.spacing(2),
    flex: 1,
    color: theme.colors.text.secondary,
  }),
  cardLeft: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: theme.spacing(1.5),
    flex: 1,
    minWidth: 0,
  }),
  cardRight: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  values: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
    flex: 1,
  }),
  value: css({
    textOverflow: 'ellipsis',
    wordBreak: 'break-all',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }),
});
