import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { Field, Switch, useStyles2 } from '@grafana/ui';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableOptionsInput } from 'app/features/dashboard-scene/settings/variables/components/VariableOptionsInput';
import { VariableSelectField } from 'app/features/dashboard-scene/settings/variables/components/VariableSelectField';

export type StaticOptionsType = QueryVariable['state']['staticOptions'];
export type StaticOptionsOrderType = QueryVariable['state']['staticOptionsOrder'];

interface QueryVariableStaticOptionsProps {
  staticOptions: StaticOptionsType;
  staticOptionsOrder: StaticOptionsOrderType;
  onStaticOptionsChange: (staticOptions: StaticOptionsType) => void;
  onStaticOptionsOrderChange: (staticOptionsOrder: StaticOptionsOrderType) => void;
}

const SORT_OPTIONS = [
  { label: 'Before query values', value: 'before' },
  { label: 'After query values', value: 'after' },
  { label: 'Sorted with query values', value: 'sorted' },
];

export function QueryVariableStaticOptions(props: QueryVariableStaticOptionsProps) {
  const styles = useStyles2(getStyles);

  const { staticOptions, onStaticOptionsChange, staticOptionsOrder, onStaticOptionsOrderChange } = props;

  const value = SORT_OPTIONS.find((o) => o.value === staticOptionsOrder) ?? SORT_OPTIONS[0];

  const [areStaticOptionsEnabled, setAreStaticOptionsEnabled] = useState(!!staticOptions?.length);

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.query-variable-editor-form.static-options-legend">Static options</Trans>
      </VariableLegend>
      <Field
        label={t('dashboard-scene.query-variable-editor-form.label-use-static-options"', 'Use static options')}
        description={t(
          'variables.query-variable-static-options.description',
          'Add custom options in addition to query results'
        )}
      >
        <>
          <Switch
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsToggle
            }
            value={areStaticOptionsEnabled}
            onChange={(e) => {
              if (e.currentTarget.checked) {
                setAreStaticOptionsEnabled(true);
              } else {
                setAreStaticOptionsEnabled(false);
                if (!!staticOptions?.length) {
                  onStaticOptionsChange(undefined);
                }
              }
            }}
          />

          {areStaticOptionsEnabled && (
            <div className={styles.optionsInputContainer}>
              <VariableOptionsInput width={60} options={staticOptions ?? []} onChange={onStaticOptionsChange} />
            </div>
          )}
        </>
      </Field>

      {areStaticOptionsEnabled && (
        <>
          <VariableSelectField
            name="Static options sort"
            description={t(
              'variables.query-variable-sort-select.description-values-variable',
              'How to sort static options with query results'
            )}
            value={value}
            options={SORT_OPTIONS}
            onChange={(opt) => onStaticOptionsOrderChange(opt.value)}
            testId={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsOrderDropdown
            }
            width={25}
          />
        </>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  optionsInputContainer: css({
    marginTop: theme.spacing(2),
  }),
});
