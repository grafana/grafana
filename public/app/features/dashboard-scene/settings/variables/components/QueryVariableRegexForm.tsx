import { useMemo, FormEvent } from 'react';

import { VariableRegexApplyTo, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Stack, TextLink, RadioButtonGroup, Box } from '@grafana/ui';

import { VariableTextAreaField } from '../components/VariableTextAreaField';

interface Props {
  regex: string | null;
  onRegExChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  regexApplyTo?: VariableRegexApplyTo;
  onRegexApplyToChange?: (option: VariableRegexApplyTo) => void;
}

export function QueryVariableRegexForm({ regex, regexApplyTo, onRegExChange, onRegexApplyToChange }: Props) {
  const APPLY_REGEX_TO_OPTIONS: Array<SelectableValue<VariableRegexApplyTo>> = useMemo(
    () => [
      {
        label: t('dashboard-scene.query-variable-editor-form.regex-apply-to-options.label.value', 'Variable value'),
        value: 'value',
      },
      {
        label: t('dashboard-scene.query-variable-editor-form.regex-apply-to-options.label.text', 'Display text'),
        value: 'text',
      },
    ],
    []
  );

  const regexApplyToValue = useMemo(
    () => APPLY_REGEX_TO_OPTIONS.find((o) => o.value === regexApplyTo)?.value ?? APPLY_REGEX_TO_OPTIONS[0].value,
    [regexApplyTo, APPLY_REGEX_TO_OPTIONS]
  );

  return (
    <Box marginBottom={2}>
      <Stack direction="column" gap={2}>
        <VariableTextAreaField
          defaultValue={regex ?? ''}
          name={t('dashboard-scene.query-variable-editor-form.name-regex', 'Regex')}
          description={
            <div>
              <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-optional">
                Optional, if you want to extract part of a series name or metric node segment.
              </Trans>
              <br />
              <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-examples">
                Named capture groups can be used to separate the display text and value (
                <TextLink
                  href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                  external
                >
                  see examples
                </TextLink>
                ).
              </Trans>
            </div>
          }
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="/.*-(?<text>.*)-(?<value>.*)-.*/"
          onBlur={onRegExChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2}
          width={52}
          noMargin
        />

        {onRegexApplyToChange && (
          <Field
            label={t('dashboard-scene.query-variable-editor-form.label-regex-apply-to', 'Apply regex to')}
            description={t(
              'dashboard-scene.query-variable-editor-form.description-regex-apply-to',
              'Choose whether to apply the regex pattern to the variable value or display text'
            )}
            data-testid={
              selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExApplyToSelectV2
            }
            noMargin
          >
            <RadioButtonGroup
              options={APPLY_REGEX_TO_OPTIONS}
              onChange={onRegexApplyToChange}
              value={regexApplyToValue}
            />
          </Field>
        )}
      </Stack>
    </Box>
  );
}
