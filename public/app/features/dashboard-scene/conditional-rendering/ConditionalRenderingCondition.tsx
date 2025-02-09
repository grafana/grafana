import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Select, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface ConditionalRenderingConditionState extends SceneObjectState {
  value: 'and' | 'or';
}

export class ConditionalRenderingCondition extends SceneObjectBase<ConditionalRenderingConditionState> {
  public static Component = ConditionalRenderingConditionRenderer;

  public evaluate(): boolean {
    return true;
  }

  public changeValue(value: 'and' | 'or') {
    this.setState({ value });
  }
}

function ConditionalRenderingConditionRenderer({ model }: SceneComponentProps<ConditionalRenderingCondition>) {
  const styles = useStyles2(getStyles);
  const { value } = model.useState();

  const options: Array<SelectableValue<'and' | 'or'>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.condition.and', 'And'), value: 'and' },
      { label: t('dashboard.conditional-rendering.condition.or', 'Or'), value: 'or' },
    ],
    []
  );

  const currentOption = options.find((option) => option.value === value)!;

  return (
    <div className={styles.container}>
      <Select
        className={styles.selector}
        isClearable={false}
        value={currentOption}
        options={options}
        onChange={({ value }) => model.changeValue(value!)}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: theme.spacing(1, 0),
    margin: theme.spacing(1, 0),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  selector: css({
    width: 'fit-content!important',
  }),
});
