import React, { PropsWithChildren, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableHide } from '../types';

interface Props {
  onChange: (option: SelectableValue<VariableHide>) => void;
  hide: VariableHide;
}

const HIDE_OPTIONS = [
  { label: '', value: VariableHide.dontHide },
  { label: 'Label', value: VariableHide.hideLabel },
  { label: 'Variable', value: VariableHide.hideVariable },
];

export function VariableHideSelect({ onChange, hide }: PropsWithChildren<Props>) {
  const value = useMemo(() => HIDE_OPTIONS.find(o => o.value === hide) ?? HIDE_OPTIONS[0], [hide]);

  return (
    <VariableSelectField
      name="Hide"
      value={value}
      options={HIDE_OPTIONS}
      onChange={onChange}
      ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect}
    />
  );
}
