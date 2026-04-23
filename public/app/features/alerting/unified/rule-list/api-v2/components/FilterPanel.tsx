import { css } from '@emotion/css';
import { produce } from 'immer';

import { ContactPointSelector } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Input, Label, MultiCombobox, Select, useStyles2 } from '@grafana/ui';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import {
  useAlertingDataSourceOptions,
  useLabelOptions,
} from '../../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { RuleHealth, RuleSource } from '../../../search/rulesSearchParser';
import { usePluginsFilterStatus } from '../../filter/utils';
import { type StateChip, type StateChipCounts } from '../lib/types';

import { StateChipRow } from './StateChipRow';

interface Props {
  counts: StateChipCounts;
  activeChips: Set<StateChip>;
  onToggleChip: (chip: StateChip) => void;
  hasAnyActive: boolean;
  onClearAll: () => void;
}

function getHealthOptions() {
  return [
    { label: t('alerting.rule-list-v2.health-all', 'All'), value: undefined },
    { label: t('alerting.rule-list-v2.health-ok', 'OK'), value: RuleHealth.Ok },
    { label: t('alerting.rule-list-v2.health-nodata', 'No data'), value: RuleHealth.NoData },
    { label: t('alerting.rule-list-v2.health-error', 'Error'), value: RuleHealth.Error },
  ];
}

function getSourceOptions() {
  return [
    { label: t('alerting.rule-list-v2.source-all', 'All'), value: undefined },
    { label: t('alerting.rule-list-v2.source-grafana', 'Grafana managed'), value: RuleSource.Grafana },
    { label: t('alerting.rule-list-v2.source-datasource', 'Data source managed'), value: RuleSource.DataSource },
  ];
}

function getTypeOptions() {
  return [
    { label: t('alerting.rule-list-v2.type-all', 'All'), value: undefined },
    { label: t('alerting.rule-list-v2.type-alert', 'Alert rule'), value: PromRuleType.Alerting },
    { label: t('alerting.rule-list-v2.type-recording', 'Recording rule'), value: PromRuleType.Recording },
  ];
}

function getPluginOptions() {
  return [
    { label: t('alerting.rule-list-v2.plugin-show', 'Show'), value: undefined },
    { label: t('alerting.rule-list-v2.plugin-hide', 'Hide'), value: 'hide' as const },
  ];
}

export function FilterPanel({ counts, activeChips, onToggleChip, hasAnyActive, onClearAll }: Props) {
  const styles = useStyles2(getStyles);
  const { filterState, updateFilters, hasActiveFilters, clearAll: clearSearchFilters } = useRulesFilter();
  const { labelOptions } = useLabelOptions();
  const dataSourceOptions = useAlertingDataSourceOptions();
  const { pluginsFilterEnabled } = usePluginsFilterStatus();

  const canClear = hasActiveFilters || hasAnyActive;

  function apply(updater: (draft: typeof filterState) => void) {
    updateFilters(produce(filterState, updater));
  }

  function handleClearAll() {
    clearSearchFilters();
    onClearAll();
  }

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <StateChipRow counts={counts} active={activeChips} onToggle={onToggleChip} />
        <Button size="sm" variant="secondary" fill="text" icon="times" onClick={handleClearAll} disabled={!canClear}>
          <Trans i18nKey="alerting.rule-list-v2.clear-filters">Clear filters</Trans>
        </Button>
      </div>

      <div className={styles.grid}>
        <Field label={t('alerting.rule-list-v2.field.rule-name', 'Rule name')}>
          <Input
            placeholder={t('alerting.rule-list-v2.field.rule-name-placeholder', 'Filter by name...')}
            defaultValue={filterState.ruleName ?? ''}
            onBlur={(e) => apply((d) => void (d.ruleName = e.currentTarget.value || undefined))}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.labels', 'Labels')}>
          <MultiCombobox
            options={labelOptions}
            value={filterState.labels}
            onChange={(selections) => apply((d) => void (d.labels = selections.map((s) => s.value)))}
            placeholder={t('alerting.rule-list-v2.field.labels-placeholder', 'env=prod, team=...')}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.rule-source', 'Rule source')}>
          <Select
            options={getSourceOptions()}
            value={filterState.ruleSource}
            onChange={(option) => apply((d) => void (d.ruleSource = option?.value))}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.data-source', 'Data source')}>
          <MultiCombobox
            options={dataSourceOptions}
            value={filterState.dataSourceNames}
            onChange={(selections) => apply((d) => void (d.dataSourceNames = selections.map((s) => s.value)))}
            placeholder={t('alerting.rule-list-v2.field.data-source-placeholder', 'Select data sources')}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.contact-point', 'Contact point')}>
          <ContactPointSelector
            placeholder={t('alerting.rule-list-v2.field.contact-point-placeholder', 'Select contact point')}
            value={'contactPoint' in filterState ? (filterState.contactPoint ?? null) : null}
            isClearable
            onChange={(cp) => {
              const name = cp?.spec.title ?? null;
              apply((d) => {
                if (name) {
                  Object.assign(d, { contactPoint: name, policy: undefined });
                } else {
                  Object.assign(d, { contactPoint: undefined });
                }
              });
            }}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.health', 'Health')}>
          <Select
            options={getHealthOptions()}
            value={filterState.ruleHealth}
            onChange={(option) => apply((d) => void (d.ruleHealth = option?.value))}
          />
        </Field>

        <Field label={t('alerting.rule-list-v2.field.rule-type', 'Type')}>
          <Select
            options={getTypeOptions()}
            value={filterState.ruleType}
            onChange={(option) => apply((d) => void (d.ruleType = option?.value))}
          />
        </Field>

        {pluginsFilterEnabled && (
          <Field label={t('alerting.rule-list-v2.field.plugin-rules', 'Plugin rules')}>
            <Select
              options={getPluginOptions()}
              value={filterState.plugins}
              onChange={(option) => apply((d) => void (d.plugins = option?.value))}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.field}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    panel: css({
      padding: theme.spacing(1.5, 2),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: theme.spacing(1),
    }),
    field: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
  };
}
