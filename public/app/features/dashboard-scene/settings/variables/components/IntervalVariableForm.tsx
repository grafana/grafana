import { css } from '@emotion/css';
import { ChangeEvent, FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableLegend } from './VariableLegend';
import { VariableSelectField } from './VariableSelectField';
import { VariableTextField } from './VariableTextField';

interface IntervalVariableFormProps {
  intervals: string;
  onIntervalsChange: (event: FormEvent<HTMLInputElement>) => void;
  onAutoEnabledChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAutoMinIntervalChanged: (event: FormEvent<HTMLInputElement>) => void;
  onAutoCountChanged: (option: SelectableValue) => void;
  autoEnabled: boolean;
  autoMinInterval: string;
  autoStepCount: number;
}

export function IntervalVariableForm({
  intervals,
  onIntervalsChange,
  onAutoEnabledChange,
  onAutoMinIntervalChanged,
  onAutoCountChanged,
  autoEnabled,
  autoMinInterval,
  autoStepCount,
}: IntervalVariableFormProps) {
  const STEP_OPTIONS = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map((count) => ({
    label: `${count}`,
    value: count,
  }));
  const styles = useStyles2(getStyles);

  const stepCount = STEP_OPTIONS.find((option) => option.value === autoStepCount) ?? STEP_OPTIONS[0];

  return (
    <>
      {/*BMC Change: To enable localization for below text*/}
      <VariableLegend>
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.internal.title">Interval options</Trans>
      </VariableLegend>
      <VariableTextField
        defaultValue={intervals}
        name={t('bmcgrafana.dashboards.settings.variables.editor.types.internal.values', 'Values')}
        placeholder="1m,10m,1h,6h,1d,7d"
        onBlur={onIntervalsChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput}
        width={32}
        required
      />

      <VariableCheckboxField
        value={autoEnabled}
        name={t('bmcgrafana.dashboards.settings.variables.editor.types.internal.auto-option-name', 'Auto option')}
        description={t(
          'bmcgrafana.dashboards.settings.variables.editor.types.internal.auto-option-description',
          'Dynamically calculates interval by dividing time range by the count specified'
        )}
        onChange={onAutoEnabledChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.autoEnabledCheckbox}
      />
      {autoEnabled && (
        <div className={styles.autoFields}>
          <VariableSelectField
            name={t('bmcgrafana.dashboards.settings.variables.editor.types.internal.step-count-name', 'Step count')}
            description={t(
              'bmcgrafana.dashboards.settings.variables.editor.types.internal.step-count-description',
              'How many times the current time range should be divided to calculate the value'
            )}
            value={stepCount}
            options={STEP_OPTIONS}
            onChange={onAutoCountChanged}
            width={9}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.stepCountIntervalSelect}
          />
          <VariableTextField
            value={autoMinInterval}
            name={t('bmcgrafana.dashboards.settings.variables.editor.types.internal.min-interval-name', 'Min interval')}
            description={t(
              'bmcgrafana.dashboards.settings.variables.editor.types.internal.min-interval-description',
              'The calculated value will not go below this threshold'
            )}
            placeholder="10s"
            onChange={onAutoMinIntervalChanged}
            width={11}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.minIntervalInput}
          />
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    autoFields: css({
      marginTop: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
    }),
  };
};
