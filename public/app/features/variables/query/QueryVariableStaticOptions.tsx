import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { Field, Stack, Switch } from '@grafana/ui';
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
  const { staticOptions, onStaticOptionsChange, staticOptionsOrder, onStaticOptionsOrderChange } = props;

  const value = SORT_OPTIONS.find((o) => o.value === staticOptionsOrder) ?? SORT_OPTIONS[0];

  const [areStaticOptionsEnabled, setAreStaticOptionsEnabled] = useState(!!staticOptions?.length);

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.query-variable-editor-form.static-options-legend">Static options</Trans>
      </VariableLegend>
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('dashboard-scene.query-variable-editor-form.label-use-static-options', 'Use static options')}
          description={t(
            'variables.query-variable-static-options.description',
            'Add custom options in addition to query results'
          )}
        >
          <>
            <Stack direction="column" gap={2}>
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
                <VariableOptionsInput width={60} options={staticOptions ?? []} onChange={onStaticOptionsChange} />
              )}
            </Stack>
          </>
        </Field>

        {areStaticOptionsEnabled && (
          <VariableSelectField
            name={t('dashboard-scene.query-variable-editor-form.label-static-options-sort', 'Static options sort')}
            description={t(
              'variables.query-variable-static-options-sort-select.description-values-variable',
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
        )}
      </Stack>
    </>
  );
}
