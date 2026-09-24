import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, IconButton, Input, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { parseMetricsFilter, summarizeMetricsFilter, validateMetricsScope } from '../solutions/metricsFilter';
import { diskRatioExpr, hasDiskSelection, type MetricsDiskScope } from '../solutions/telemetryData';

import { type CardFilterActionsProps, SolutionFilterActions, type SolutionFilterSpec } from './SolutionFilterActions';

const NO_SCOPE: MetricsDiskScope = { excludes: [], ratioExpr: '' };
const EMPTY_ROW = { label: 'instance', regex: '' };

// node_exporter's own filesystem labels; relabeled ones (cluster, env, …) are typed in.
const FILESYSTEM_LABELS = ['instance', 'job', 'mountpoint', 'device', 'fstype'].map((value) => ({
  label: value,
  value,
}));

// Dimension names only; label names and patterns are customer data and never leave the browser.
function customizedDimensions(scope: MetricsDiskScope): string {
  const dimensions: string[] = [];
  if (scope.excludes.some((row) => row.label.trim() !== '' && row.regex.trim() !== '')) {
    dimensions.push('excludes');
  }
  if (scope.ratioExpr.trim() !== '') {
    dimensions.push('expression');
  }
  return dimensions.join(',');
}

const spec: SolutionFilterSpec<MetricsDiskScope> = {
  solution: 'metrics',
  parse: parseMetricsFilter,
  summarize: summarizeMetricsFilter,
  emptyScope: NO_SCOPE,
  hasSelection: hasDiskSelection,
  customized: customizedDimensions,
  validate: validateMetricsScope,
};

export function MetricsFilterActions({ datasource, attention }: CardFilterActionsProps) {
  return (
    <SolutionFilterActions
      spec={spec}
      datasource={datasource}
      attention={attention}
      openLabel={t('home.solutions.metrics.filter.open', 'Exclude hosts or filesystems from the disk alert')}
      title={t('home.solutions.metrics.filter.title', 'Customize the disk alert')}
    >
      {(draft, onChange) => <MetricsFilterFields draft={draft} onChange={onChange} />}
    </SolutionFilterActions>
  );
}

interface MetricsFilterFieldsProps {
  draft: MetricsDiskScope;
  onChange: (scope: MetricsDiskScope) => void;
}

function MetricsFilterFields({ draft, onChange }: MetricsFilterFieldsProps) {
  const styles = useStyles2(getStyles);
  // Exclusions are matchers inside the default formula; a custom expression has no place for them.
  const custom = draft.ratioExpr.trim() !== '';
  // Always one row to fill in; a lone row cannot be removed, only emptied.
  const rows = draft.excludes.length > 0 ? draft.excludes : [EMPTY_ROW];
  const setRow = (index: number, row: MetricsDiskScope['excludes'][number]) =>
    onChange({ ...draft, excludes: rows.map((current, i) => (i === index ? row : current)) });

  return (
    <>
      <Field
        label={t('home.solutions.metrics.filter.excludes', 'Exclude')}
        description={
          custom
            ? t('home.solutions.metrics.filter.excludes-disabled', 'Add matchers to the custom expression instead.')
            : t(
                'home.solutions.metrics.filter.excludes-description',
                'Filesystems whose label matches the pattern are left out of the alert and the host count.'
              )
        }
        noMargin
      >
        <Stack direction="column" gap={1}>
          {rows.map((row, index) => (
            <Stack key={index} direction="row" gap={1}>
              <Combobox<string>
                aria-label={t('home.solutions.metrics.filter.exclude-label', 'Label')}
                options={FILESYSTEM_LABELS}
                value={row.label || null}
                createCustomValue
                disabled={custom}
                width={20}
                onChange={(option) => setRow(index, { ...row, label: option?.value ?? '' })}
              />
              <Input
                aria-label={t('home.solutions.metrics.filter.exclude-pattern', 'Pattern')}
                placeholder={t('home.solutions.metrics.filter.exclude-pattern-placeholder', 'cache-.*')}
                value={row.regex}
                disabled={custom}
                onChange={(event) => setRow(index, { ...row, regex: event.currentTarget.value })}
              />
              {rows.length > 1 && (
                <IconButton
                  name="trash-alt"
                  tooltip={t('home.solutions.metrics.filter.exclude-remove', 'Remove exclusion')}
                  disabled={custom}
                  onClick={() => onChange({ ...draft, excludes: rows.filter((_, i) => i !== index) })}
                />
              )}
            </Stack>
          ))}
          <div>
            <Button
              variant="secondary"
              fill="outline"
              size="sm"
              icon="plus"
              disabled={custom}
              onClick={() => onChange({ ...draft, excludes: [...rows, EMPTY_ROW] })}
            >
              <Trans i18nKey="home.solutions.metrics.filter.exclude-add">Add exclusion</Trans>
            </Button>
          </div>
        </Stack>
      </Field>
      <Field
        label={t('home.solutions.metrics.filter.expression', 'Custom expression')}
        description={t(
          'home.solutions.metrics.filter.expression-description',
          'Replaces the formula behind the alert. It must return a value between 0 (empty) and 1 (full) per filesystem, with instance and mountpoint labels.'
        )}
        noMargin
      >
        <TextArea
          aria-label={t('home.solutions.metrics.filter.expression', 'Custom expression')}
          className={styles.expression}
          rows={3}
          value={draft.ratioExpr}
          placeholder={diskRatioExpr(null)}
          onChange={(event) => onChange({ ...draft, ratioExpr: event.currentTarget.value })}
        />
      </Field>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  expression: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});
