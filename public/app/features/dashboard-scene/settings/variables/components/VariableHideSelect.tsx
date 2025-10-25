import { PropsWithChildren, useMemo } from 'react';

import { VariableType, VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

interface Props {
  onChange: (option: VariableHide) => void;
  hide: VariableHide;
  type: VariableType;
  autoFocus?: boolean;
}

export function VariableHideSelect({ onChange, hide, type, autoFocus }: PropsWithChildren<Props>) {
  const HIDE_OPTIONS = useMemo(
    () => [
      {
        label: t('dashboard-scene.variable-hide-select.hide_options-default', 'Top controls (default)'),
        value: VariableHide.dontHide,
      },
      {
        label: t('dashboard-scene.variable-hide-select.hide_options-label', 'Top controls (hidden label)'),
        value: VariableHide.hideLabel,
      },
      {
        label: t('dashboard-scene.variable-hide-select.hide_options-controls-menu', 'Controls menu'),
        value: 3,
      },
      {
        label: t('dashboard-scene.variable-hide-select.hide_options-hidden', 'Hidden'),
        value: VariableHide.hideVariable,
      },
    ],
    []
  );
  const value = useMemo(
    () => HIDE_OPTIONS.find((o) => o.value === hide)?.value ?? HIDE_OPTIONS[0].value,
    [hide, HIDE_OPTIONS]
  );

  if (type === 'constant') {
    return null;
  }

  return (
    <Select
      options={HIDE_OPTIONS}
      onChange={(v) => onChange(v.value!)}
      value={value}
      autoFocus={autoFocus}
      openMenuOnFocus={true}
    />
  );

  // return (
  //   <Field label={t('dashboard-scene.variable-hide-select.label', 'Hide')}>
  //     <RadioButtonGroup options={HIDE_OPTIONS} onChange={onChange} value={value} />
  //   </Field>
  // );
}
