import { css } from '@emotion/css';
import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { GroupConditionVisibility, ItemsWithConditionalRendering } from './types';

interface Props {
  itemType: ItemsWithConditionalRendering;
  value: GroupConditionVisibility;
  onChange: (value: GroupConditionVisibility) => void;
}

export const ConditionalRenderingGroupVisibility = ({ itemType, value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const label = useMemo(() => getItemLabel(itemType), [itemType]);

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

const getItemLabel = (itemType: ItemsWithConditionalRendering) => {
  switch (itemType) {
    case 'auto-grid-item':
      return t('dashboard.conditional-rendering.group.visibility.label.panel', 'Panel visibility');
    case 'row':
      return t('dashboard.conditional-rendering.group.visibility.label.row', 'Row visibility');
    case 'tab':
      return t('dashboard.conditional-rendering.group.visibility.label.tab', 'Tab visibility');
    default:
      return t('dashboard.conditional-rendering.group.visibility.label.other', 'Element visibility');
  }
};
