import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { GroupConditionVisibility, ItemsWithConditionalRendering } from './types';
import { translatedItemType } from './utils';

interface Props {
  itemType: ItemsWithConditionalRendering;
  value: GroupConditionVisibility;
  onChange: (value: GroupConditionVisibility) => void;
}

export const ConditionalRenderingGroupVisibility = ({ itemType, value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<GroupConditionVisibility>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.conditions.group.visibility.show', 'Show'), value: 'show' },
      { label: t('dashboard.conditional-rendering.conditions.group.visibility.hide', 'Hide'), value: 'hide' },
    ],
    []
  );

  return (
    <Field
      label={t('dashboard.conditional-rendering.conditions.group.visibility.label', '{{type}} visibility', {
        type: capitalize(translatedItemType(itemType)),
      })}
      className={styles.container}
    >
      <RadioButtonGroup fullWidth options={options} value={value} onChange={onChange} />
    </Field>
  );
};

const getStyles = () => ({
  container: css({
    margin: 0,
  }),
});
