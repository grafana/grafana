import { PropsWithChildren, useMemo } from 'react';

import { VariableHide, VariableType } from '@grafana/data';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  onChange: (option: VariableHide) => void;
  hide: VariableHide;
  type: VariableType;
}

export const HIDE_OPTIONS = () => {
  return [
    {
      label: t('bmcgrafana.dashboards.settings.variables.editor.variable-hide-select.label-value', 'Label and value'),
      value: VariableHide.dontHide,
    },
    {
      label: t('bmcgrafana.dashboards.settings.variables.editor.variable-hide-select.value', 'Value'),
      value: VariableHide.hideLabel,
    },
    {
      label: t('bmcgrafana.dashboards.settings.variables.editor.variable-hide-select.nothing', 'Nothing'),
      value: VariableHide.hideVariable,
    },
  ];
};

export function VariableHideSelect({ onChange, hide, type }: PropsWithChildren<Props>) {
  const hideoptions = useMemo(() => {
    return HIDE_OPTIONS();
  }, []);

  const value = useMemo(
    () => hideoptions.find((o) => o.value === hide)?.value ?? hideoptions[0].value,
    [hide, hideoptions]
  );

  if (type === 'constant') {
    return null;
  }
  {
    /*BMC Change: To enable localization for below text*/
  }
  return (
    <Field label={t('bmcgrafana.dashboards.settings.variables.editor.variable-hide-select.label', 'Show on dashboard')}>
      <RadioButtonGroup options={hideoptions} onChange={onChange} value={value} />
    </Field>
  );
}
