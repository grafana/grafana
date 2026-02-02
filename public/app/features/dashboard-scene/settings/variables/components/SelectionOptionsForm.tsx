import { ChangeEvent, FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Stack, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { VariableCheckboxField } from 'app/features/dashboard-scene/settings/variables/components/VariableCheckboxField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';

interface SelectionOptionsFormProps {
  multi: boolean;
  includeAll: boolean;
  allowCustomValue?: boolean;
  allValue?: string | null;
  onMultiChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  // BMC change: Below all props
  onIncludeOnlyAvailable?: (event: ChangeEvent<HTMLInputElement>) => void;
  query?: any;
  discardForAll?: boolean;
}

export function SelectionOptionsForm({
  multi,
  allowCustomValue,
  includeAll,
  allValue,
  onMultiChange,
  onAllowCustomValueChange,
  onIncludeAllChange,
  onAllValueChange,
  // BMC change: Below all props
  onIncludeOnlyAvailable,
  query,
  discardForAll,
}: SelectionOptionsFormProps) {
  // BMC change next line
  const theme = useTheme2();
  return (
    <Stack direction="column" gap={2} height="inherit" alignItems="start">
      <VariableCheckboxField
        value={multi}
        name={t('bmcgrafana.dashboards.settings.variables.editor.multi-value', 'Multi-value')}
        description={t(
          'bmcgrafana.dashboards.settings.variables.editor.multi-value-desc',
          'Enables multiple values to be selected at the same time'
        )}
        onChange={onMultiChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}
      />
      {onAllowCustomValueChange && ( // backwards compat with old arch, remove on cleanup
        <VariableCheckboxField
          // BMC code: allowCustomValue defaults to false
          value={allowCustomValue ?? false}
          name="Allow custom values"
          description="Enables users to add custom values to the list"
          onChange={onAllowCustomValueChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
        />
      )}
      <VariableCheckboxField
        value={includeAll}
        name={t('bmcgrafana.dashboards.settings.variables.editor.include-all', 'Include All option')}
        // BMC change inline
        description={t(
          'bmcgrafana.dashboards.settings.variables.editor.include-all-desc',
          'Enables an option to include all variable values'
        )}
        onChange={onIncludeAllChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
      />
      {/* BMC change starts */}
      {(query?.startsWith?.('remedy') || (query as any)?.sourceType === 'remedy') &&
        includeAll &&
        onIncludeOnlyAvailable &&
        (getFeatureStatus('bhd-ar-all-values') || getFeatureStatus('bhd-ar-all-values-v2')) && (
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: `${theme.typography.size.lg}` }}>
            <VariableCheckboxField
              value={discardForAll === undefined ? getDefaultValueForDiscard() : discardForAll}
              name={t('bmcgrafana.dashboards.settings.variables.editor.exlude-variable', 'Exclude variable')}
              description={t(
                'bmcgrafana.dashboards.settings.variables.editor.exlude-variable-desc',
                'Select to exclude the variable from the query'
              )}
              onChange={onIncludeOnlyAvailable}
            />
          </div>
        )}
      {/* BMC change Ends */}
      {includeAll && (
        <VariableTextField
          defaultValue={allValue ?? ''}
          onBlur={onAllValueChange}
          name={t('bmcgrafana.dashboards.settings.variables.editor.custom-all', 'Custom all value')}
          placeholder={t('bmcgrafana.dashboards.settings.variables.editor.custom-all-placeholder', 'blank = auto')}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
        />
      )}
    </Stack>
  );
}

const getDefaultValueForDiscard = (): boolean => {
  return getFeatureStatus('bhd-ar-all-values-v2') ? false : true;
};
