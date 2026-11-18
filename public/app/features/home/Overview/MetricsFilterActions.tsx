import { css } from '@emotion/css';
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, IconButton, Input, Stack, useStyles2 } from '@grafana/ui';

import {
  hasDiskSelection,
  labelIssue,
  type MetricsDiskScope,
  parseMetricsFilter,
  patternIssue,
  summarizeMetricsFilter,
} from '../solutions/metricsFilter';

import { type CardFilterActionsProps, SolutionFilterActions, type SolutionFilterSpec } from './SolutionFilterActions';

const EMPTY_ROW = { label: 'instance', regex: '' };
// A new filter opens with one row to fill in.
const BLANK_FORM: MetricsDiskScope = { excludes: [EMPTY_ROW] };

// node_exporter's own filesystem labels; relabeled ones (cluster, env, …) are typed in.
const FILESYSTEM_LABELS = ['instance', 'job', 'mountpoint', 'device', 'fstype'].map((value) => ({
  label: value,
  value,
}));

const spec: SolutionFilterSpec<MetricsDiskScope> = {
  solution: 'metrics',
  parse: parseMetricsFilter,
  summarize: summarizeMetricsFilter,
  defaultValues: (filter) => (filter ? { excludes: filter.excludes } : BLANK_FORM),
  hasSelection: hasDiskSelection,
  // Dimension name only; label names and patterns are customer data and never leave the browser.
  customized: () => 'excludes',
};

export function MetricsFilterActions({ datasource }: CardFilterActionsProps) {
  return (
    <SolutionFilterActions
      spec={spec}
      datasource={datasource}
      openLabel={t('home.solutions.metrics.filter.open', 'Exclude hosts or filesystems from the disk alert')}
      title={t('home.solutions.metrics.filter.title', 'Customize the disk alert')}
    >
      {(form) => <MetricsFilterFields form={form} />}
    </SolutionFilterActions>
  );
}

function MetricsFilterFields({ form: { control, register, formState } }: { form: UseFormReturn<MetricsDiskScope> }) {
  const styles = useStyles2(getStyles);
  const { fields, append, remove } = useFieldArray({ control, name: 'excludes' });

  return (
    <Field
      label={t('home.solutions.metrics.filter.excludes', 'Exclude')}
      description={t(
        'home.solutions.metrics.filter.excludes-description',
        'Matching filesystems are left out of the alert and the host count'
      )}
      noMargin
    >
      <Stack direction="column" gap={1}>
        {fields.map((row, index) => {
          const errors = formState.errors.excludes?.[index];
          return (
            <Stack key={row.id} direction="row" gap={1} alignItems="flex-start">
              <Field noMargin invalid={!!errors?.label} error={errors?.label?.message}>
                <Controller
                  control={control}
                  name={`excludes.${index}.label`}
                  rules={{ validate: (value) => labelIssue(value) ?? true }}
                  render={({ field }) => (
                    <Combobox<string>
                      aria-label={t('home.solutions.metrics.filter.exclude-label', 'Label')}
                      options={FILESYSTEM_LABELS}
                      value={field.value || null}
                      createCustomValue
                      invalid={!!errors?.label}
                      width={20}
                      onChange={(option) => field.onChange(option?.value ?? '')}
                    />
                  )}
                />
              </Field>
              <Field noMargin invalid={!!errors?.regex} error={errors?.regex?.message} className={styles.pattern}>
                <Input
                  aria-label={t('home.solutions.metrics.filter.exclude-pattern', 'Pattern')}
                  placeholder={t('home.solutions.metrics.filter.exclude-pattern-placeholder', 'cache-.*')}
                  {...register(`excludes.${index}.regex`, { validate: (value) => patternIssue(value) ?? true })}
                />
              </Field>
              {fields.length > 1 && (
                <IconButton
                  name="trash-alt"
                  tooltip={t('home.solutions.metrics.filter.exclude-remove', 'Remove exclusion')}
                  onClick={() => remove(index)}
                />
              )}
            </Stack>
          );
        })}
        <div>
          <Button variant="secondary" fill="outline" size="sm" icon="plus" onClick={() => append(EMPTY_ROW)}>
            <Trans i18nKey="home.solutions.metrics.filter.exclude-add">Add exclusion</Trans>
          </Button>
        </div>
      </Stack>
    </Field>
  );
}

const getStyles = () => ({
  pattern: css({
    flex: 1,
  }),
});
