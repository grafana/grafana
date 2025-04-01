import { css } from '@emotion/css';
import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AutoGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { GroupConditionVisibility } from './types';

interface Props {
  item: SceneObject;
  value: GroupConditionVisibility;
  onChange: (value: GroupConditionVisibility) => void;
}

export const ConditionalRenderingGroupVisibility = ({ item, value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const label = useMemo(() => getItemLabel(item), [item]);

  const options: Array<SelectableValue<GroupConditionVisibility>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.visibility.show', 'Show'), value: 'show' },
      { label: t('dashboard.conditional-rendering.group.visibility.hide', 'Hide'), value: 'hide' },
    ],
    []
  );

  return (
    <Field label={label} className={styles.container}>
      <RadioButtonGroup fullWidth options={options} value={value} onChange={onChange} />
    </Field>
  );
};

const getStyles = () => ({
  container: css({
    margin: 0,
  }),
});

const getItemLabel = (item: SceneObject) => {
  if (item instanceof AutoGridItem) {
    return t('dashboard.conditional-rendering.group.visibility.label.panel', 'Panel visibility');
  } else if (item instanceof RowItem) {
    return t('dashboard.conditional-rendering.group.visibility.label.row', 'Row visibility');
  } else if (item instanceof TabItem) {
    return t('dashboard.conditional-rendering.group.visibility.label.tab', 'Tab visibility');
  } else {
    return t('dashboard.conditional-rendering.group.visibility.label.other', 'Element visibility');
  }
};
