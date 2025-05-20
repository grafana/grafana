import { PropsWithChildren, useMemo } from 'react';

import { VariableType, VariableHide } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { Field, RadioButtonGroup } from '@grafana/ui';

interface Props {
  onChange: (option: VariableHide) => void;
  hide: VariableHide;
  type: VariableType;
}

const HIDE_OPTIONS = [
  { label: 'Nothing', value: VariableHide.dontHide },
  { label: 'Variable', value: VariableHide.hideVariable },
  { label: 'Label', value: VariableHide.hideLabel },
];

export function VariableHideSelect({ onChange, hide, type }: PropsWithChildren<Props>) {
  const value = useMemo(() => HIDE_OPTIONS.find((o) => o.value === hide)?.value ?? HIDE_OPTIONS[0].value, [hide]);
  const { t } = useTranslate();

  if (type === 'constant') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.variable-hide-select.label', 'Hide')}>
      <RadioButtonGroup options={HIDE_OPTIONS} onChange={onChange} value={value} />
    </Field>
  );
}
