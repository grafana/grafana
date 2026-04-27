import { type PropsWithChildren, useId, useMemo } from 'react';

import { type VariableType, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Combobox, Field } from '@grafana/ui';

import { type VariableSectionType } from '../variableSectionType';

interface Props {
  onChange: (option: VariableHide) => void;
  display: VariableHide;
  type: VariableType;
  sectionType?: VariableSectionType;
  hideControlsMenuOption?: boolean;
  minWidth?: number;
}

export function VariableDisplaySelect({
  onChange,
  display,
  type,
  sectionType = 'dashboard',
  hideControlsMenuOption = false,
  minWidth = 52,
}: PropsWithChildren<Props>) {
  const displayId = useId();
  const OPTIONS = useMemo(() => {
    const labels = getDisplayLabels(sectionType);

    return [
      {
        value: VariableHide.dontHide,
        label: labels.visibleLabel,
      },
      {
        value: VariableHide.hideLabel,
        label: labels.hiddenLabel,
        description: labels.hiddenLabelDescription,
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
    ];
  }, [hideControlsMenuOption, sectionType]);
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

function getDisplayLabels(sectionType: VariableSectionType) {
  switch (sectionType) {
    case 'row':
      return {
        visibleLabel: t('dashboard-scene.variable-display-select.options.top-of-row.label', 'Top of row'),
        hiddenLabel: t(
          'dashboard-scene.variable-display-select.options.top-of-row-hidden-label.label',
          'Top of row, label hidden'
        ),
        hiddenLabelDescription: t(
          'dashboard-scene.variable-display-select.options.top-of-row-hidden-label.description',
          'Top of row, but without showing the name of variable'
        ),
      };
    case 'tab':
      return {
        visibleLabel: t('dashboard-scene.variable-display-select.options.top-of-tab.label', 'Top of tab'),
        hiddenLabel: t(
          'dashboard-scene.variable-display-select.options.top-of-tab-hidden-label.label',
          'Top of tab, label hidden'
        ),
        hiddenLabelDescription: t(
          'dashboard-scene.variable-display-select.options.top-of-tab-hidden-label.description',
          'Top of tab, but without showing the name of variable'
        ),
      };
    case 'dashboard':
      return {
        visibleLabel: t('dashboard-scene.variable-display-select.options.above-dashboard.label', 'Above dashboard'),
        hiddenLabel: t(
          'dashboard-scene.variable-display-select.options.hidden-label.label',
          'Above dashboard, label hidden'
        ),
        hiddenLabelDescription: t(
          'dashboard-scene.variable-display-select.options.hidden-label.description',
          'Above the dashboard, but without showing the name of variable'
        ),
      };
  }
}
