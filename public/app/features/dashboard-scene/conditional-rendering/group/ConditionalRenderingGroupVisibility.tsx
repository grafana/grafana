import { useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { getTranslatedObjectType, type ObjectsWithConditionalRendering } from '../object';

import { type GroupConditionVisibility } from './types';

interface Props {
  objectType: ObjectsWithConditionalRendering;
  value: GroupConditionVisibility;
  onChange: (value: GroupConditionVisibility) => void;
}

export const ConditionalRenderingGroupVisibility = ({ objectType, value, onChange }: Props) => {
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
        type: getTranslatedObjectType(objectType),
      })}
      noMargin
    >
      <RadioButtonGroup fullWidth options={options} value={value} onChange={onChange} />
    </Field>
  );
};
