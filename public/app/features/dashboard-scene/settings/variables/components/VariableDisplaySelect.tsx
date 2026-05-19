import { type PropsWithChildren, useId, useMemo } from 'react';

import { type VariableType, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Combobox, Field } from '@grafana/ui';

interface Props {
  onChange: (option: VariableHide) => void;
  display: VariableHide;
  type: VariableType;
  hideControlsMenuOption?: boolean;
  minWidth?: number;
}

export function VariableDisplaySelect({
  onChange,
  display,
  type,
  hideControlsMenuOption = false,
  minWidth = 52,
}: PropsWithChildren<Props>) {
  const displayId = useId();
  const OPTIONS = useMemo(
    () => [
      {
        value: VariableHide.dontHide,
        label: t('dashboard-scene.variable-display-select.options.above-dashboard.label', 'Above dashboard'),
      },
      {
        value: VariableHide.hideLabel,
        label: t('dashboard-scene.variable-display-select.options.hidden-label.label', 'Above dashboard, label hidden'),
        description: t(
          'dashboard-scene.variable-display-select.options.hidden-label.description',
          'Above the dashboard, but without showing the name of variable'
        ),
      },
      ...(!hideControlsMenuOption
        ? [
            {
              value: VariableHide.inControlsMenu,
              label: t('dashboard-scene.variable-display-select.options.controls-menu.label', 'Controls menu'),
              description: t(
                'dashboard-scene.variable-display-select.options.controls-menu.description',
                'Visible when the controls menu is open'
              ),
            },
          ]
        : []),
      {
        value: VariableHide.hideVariable,
        label: t('dashboard-scene.variable-display-select.options.hidden.label', 'Hidden'),
        description: t(
          'dashboard-scene.variable-display-select.options.hidden.description',
          'Only visible in edit mode'
        ),
      },
    ],
    [hideControlsMenuOption]
  );
  const value = useMemo(() => OPTIONS.find((o) => o.value === display)?.value ?? OPTIONS[0].value, [display, OPTIONS]);

  // Constant variables don't support display options
  if (type === 'constant') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.variable-display-select.label', 'Display')}>
      <Combobox
        id={displayId}
        data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalDisplaySelect}
        options={OPTIONS}
        onChange={(option) => option && onChange(option.value)}
        value={value}
        width="auto"
        minWidth={minWidth}
      />
    </Field>
  );
}
