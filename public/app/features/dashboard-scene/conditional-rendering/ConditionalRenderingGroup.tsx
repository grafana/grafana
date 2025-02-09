import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBetween } from './ConditionalRenderingBetween';
import { ConditionalRenderingCondition } from './ConditionalRenderingCondition';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingFrom } from './ConditionalRenderingFrom';
import { ConditionalRenderingTo } from './ConditionalRenderingTo';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

export interface ConditionalRenderingGroupState extends SceneObjectState {
  value: Array<
    | ConditionalRenderingData
    | ConditionalRenderingFrom
    | ConditionalRenderingTo
    | ConditionalRenderingBetween
    | ConditionalRenderingVariable
    | ConditionalRenderingCondition
    | ConditionalRenderingGroup
  >;
}

export class ConditionalRenderingGroup extends SceneObjectBase<ConditionalRenderingGroupState> {
  public static Component = ConditionalRenderingGroupRenderer;

  public evaluate(): boolean {
    if (this.state.value.length === 0) {
      return true;
    }

    let acc = this.state.value[0].evaluate();

    for (let idx = 1; idx < this.state.value.length; idx++) {
      const entry = this.state.value[idx];

      if (entry instanceof ConditionalRenderingCondition) {
        continue;
      }

      const evaluation = entry.evaluate();
      const prevItem = this.state.value[idx - 1];
      const operator =
        prevItem === undefined || !(prevItem instanceof ConditionalRenderingCondition) ? 'and' : prevItem.state.value;

      if (operator === 'and') {
        if (!evaluation) {
          return false;
        }

        acc = acc && evaluation;
      } else {
        acc = acc || evaluation;
      }
    }

    return acc;
  }

  public addItem(item: ConditionalRenderingGroup) {
    this.setState({
      value: [...this.state.value, item],
    });
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const styles = useStyles2(getStyles);
  const { value } = model.useState();

  return (
    <div className={styles.container}>
      {value.map((entry) => (
        <>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */}
          <entry.Component model={entry as any} key={entry!.state.key} />
        </>
      ))}

      <IconButton
        name="plus"
        aria-label={t('dashboard.conditional-rendering.group.add', 'Add')}
        onClick={() => model.addItem(new ConditionalRenderingGroup({ value: [] }))}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});
