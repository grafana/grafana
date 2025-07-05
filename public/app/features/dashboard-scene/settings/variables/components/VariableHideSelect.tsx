import { PropsWithChildren, useMemo } from 'react';

import { VariableType, VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup } from '@grafana/ui';

interface Props {
  onChange: (option: VariableHide) => void;
  hide: VariableHide;
  type: VariableType;
}

export function VariableHideSelect({ onChange, hide, type }: PropsWithChildren<Props>) {
  const HIDE_OPTIONS = useMemo(
    () => [
      {
        label: t('dashboard-scene.variable-hide-select.hide_options.label.nothing', 'Nothing'),
        value: VariableHide.dontHide,
      },
      {
        label: t('dashboard-scene.variable-hide-select.hide_options.label.variable', 'Variable'),
        value: VariableHide.hideVariable,
      },
      {
        label: t('dashboard-scene.variable-hide-select.hide_options.label.label', 'Label'),
        value: VariableHide.hideLabel,
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
    <Field label={t('dashboard-scene.variable-hide-select.label', 'Hide')}>
      <RadioButtonGroup options={HIDE_OPTIONS} onChange={onChange} value={value} />
    </Field>
  );
}
