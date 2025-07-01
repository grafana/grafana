import { css } from '@emotion/css';
import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { GroupConditionCondition } from './types';

interface Props {
  value: GroupConditionCondition;
  onChange: (value: GroupConditionCondition) => void;
}

export const ConditionalRenderingGroupCondition = ({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<GroupConditionCondition>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.conditions.group.condition.all', 'Match all'), value: 'and' },
      { label: t('dashboard.conditional-rendering.conditions.group.condition.any', 'Match any'), value: 'or' },
    ],
    []
  );

  return (
    <Field
      label={t('dashboard.conditional-rendering.conditions.group.condition.label', 'Match rules')}
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
