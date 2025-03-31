import { css } from '@emotion/css';
import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { GroupConditionOutcome } from './types';

interface Props {
  value: GroupConditionOutcome;
  onChange: (value: GroupConditionOutcome) => void;
}

export const ConditionalRenderingGroupOutcome = ({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<GroupConditionOutcome>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.outcome.show', 'Show'), value: 'show' },
      { label: t('dashboard.conditional-rendering.group.outcome.hide', 'Hide'), value: 'hide' },
    ],
    []
  );

  return (
    <Field
      label={t('dashboard.conditional-rendering.group.outcome.label', 'Rules outcome')}
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
