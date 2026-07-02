import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Combobox, Icon, Input, Label, MultiCombobox, Stack, useStyles2 } from '@grafana/ui';

import { useLabelOptions, useNamespaceAndGroupOptions } from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { type RulesFilter } from '../../search/rulesSearchParser';
import { Annotation, annotationLabels } from '../../utils/constants';

import {
  FINDING_TYPES,
  type FindingType,
  type FindingTypeCounts,
  type QualitySeverity,
  type SeverityCounts,
  type SeverityFilterValue,
} from './qualityFindingFilters';
import { useQualityExtraFilters } from './useQualityExtraFilters';

const SIDEBAR_WIDTH = 250;

// Icons for each severity tier, mirroring the badges used on the findings list.
const SEVERITY_ICONS: Record<QualitySeverity, IconName> = {
  high: 'exclamation-triangle',
  medium: 'exclamation-circle',
  low: 'info-circle',
};

// Icons hinting at each finding type: a summary note, a paragraph, and a runbook link.
const FINDING_ICONS: Record<FindingType, IconName> = {
  [Annotation.summary]: 'file-alt',
  [Annotation.description]: 'align-left',
  [Annotation.runbookURL]: 'book',
};

export interface QualityFilterSidebarProps {
  /** Number of in-scope rules per severity tier, shown alongside each severity option. */
  severityCounts: SeverityCounts;
  /** Number of in-scope findings per finding type, shown alongside each finding-type option. */
  findingCounts: FindingTypeCounts;
}

/**
 * Persistent filter sidebar for the Alert quality tab. Folder / labels / rule name are backed
 * by the rules `search` query; severity (single-select) and finding type (multiselect) are
 * backed by their own URL params via useQualityExtraFilters. All selections apply immediately.
 */
export function QualityFilterSidebar({ severityCounts, findingCounts }: QualityFilterSidebarProps) {
  const styles = useStyles2(getStyles);
  const { hasActiveFilters, clearAll, searchQuery, filterState } = useRulesFilter();
  const { severity, findingTypes, hasExtraFilters, setSeverity, toggleFindingType, clearExtraFilters } =
    useQualityExtraFilters();

  const showClear = hasActiveFilters || hasExtraFilters;

  const handleClearAll = () => {
    clearAll();
    clearExtraFilters();
  };

  const severityOptions: SeverityToggleOption[] = [
    { label: t('alerting.quality.filter.severity-all', 'All'), value: 'all' },
    {
      label: t('alerting.quality.filter.severity-high', 'High'),
      value: 'high',
      severity: 'high',
      count: severityCounts.high,
    },
    {
      label: t('alerting.quality.filter.severity-medium', 'Medium'),
      value: 'medium',
      severity: 'medium',
      count: severityCounts.medium,
    },
    {
      label: t('alerting.quality.filter.severity-low', 'Low'),
      value: 'low',
      severity: 'low',
      count: severityCounts.low,
    },
  ];

  return (
    <div className={styles.sidebar}>
      <Stack direction="column" gap={2}>
        <Stack direction="row" justifyContent="flex-end">
          <button type="button" className={styles.clearButton} onClick={handleClearAll} disabled={!showClear}>
            <Trans i18nKey="alerting.quality.filter.clear">Clear filters</Trans>
          </button>
        </Stack>

        {/* key remounts the name/folder/label controls when the rules query changes externally
            (top bar, clear filters, navigation) so their values always reflect the URL state. */}
        <RuleScopeSection key={searchQuery} filterState={filterState} />

        <div className={styles.divider} />

        <SidebarSection>
          <SidebarField
            label={t('alerting.quality.filter.severity-label', 'Severity')}
            labelId="quality-filter-severity"
          >
            <SeverityToggleGroup
              aria-labelledby="quality-filter-severity"
              options={severityOptions}
              value={severity}
              onChange={setSeverity}
            />
          </SidebarField>
        </SidebarSection>

        <div className={styles.divider} />

        <SidebarSection>
          <SidebarField
            label={t('alerting.quality.filter.finding-type-label', 'Finding type')}
            labelId="quality-filter-finding-type"
          >
            <div role="group" aria-labelledby="quality-filter-finding-type">
              <Stack direction="column" gap={0.5}>
                {FINDING_TYPES.map((type) => (
                  <FindingTypeToggle
                    key={type}
                    label={annotationLabels[type]}
                    icon={FINDING_ICONS[type]}
                    count={findingCounts[type]}
                    isActive={findingTypes.includes(type)}
                    onToggle={() => toggleFindingType(type)}
                  />
                ))}
              </Stack>
            </div>
          </SidebarField>
        </SidebarSection>
      </Stack>
    </div>
  );
}

interface RuleScopeSectionProps {
  filterState: RulesFilter;
}

/** Folder / Namespace, Labels and rule-name filters, all backed by the rules `search` query. */
function RuleScopeSection({ filterState }: RuleScopeSectionProps) {
  const { updateFilters } = useRulesFilter();
  const { namespaceOptions, namespacePlaceholder } = useNamespaceAndGroupOptions();
  const { labelOptions } = useLabelOptions();

  // Rule name applies on blur/Enter (not on every keystroke) so typing doesn't churn the URL
  // and remount the controls mid-edit.
  const [ruleName, setRuleName] = useState(filterState.ruleName ?? '');
  const applyRuleName = () => updateFilters({ ...filterState, ruleName: ruleName.trim() || undefined });

  return (
    <SidebarSection>
      <SidebarField label={t('alerting.quality.filter.name-label', 'Search by name')}>
        <Input
          value={ruleName}
          onChange={(event) => setRuleName(event.currentTarget.value)}
          onBlur={applyRuleName}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'NumpadEnter') {
              event.preventDefault();
              applyRuleName();
            }
          }}
          placeholder={t('alerting.quality.filter.name-placeholder', 'Filter by name...')}
          data-testid="quality-name-filter"
        />
      </SidebarField>
      <SidebarField label={<Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>}>
        <Combobox<string>
          options={namespaceOptions}
          value={filterState.namespace ?? null}
          placeholder={namespacePlaceholder}
          isClearable
          onChange={(option) => {
            if (!option?.infoOption) {
              updateFilters({ ...filterState, namespace: option?.value || undefined });
            }
          }}
        />
      </SidebarField>
      <SidebarField label={<Trans i18nKey="alerting.search.property.labels">Labels</Trans>}>
        <MultiCombobox
          options={labelOptions}
          value={filterState.labels}
          placeholder={t('alerting.rules-filter.placeholder-labels', 'Select labels')}
          onChange={(selections) => {
            updateFilters({ ...filterState, labels: selections.map((selection) => selection.value) });
          }}
        />
      </SidebarField>
    </SidebarSection>
  );
}

// ---------------------------------------------------------------------------
// Section & field layout helpers (kept local to the quality feature)
// ---------------------------------------------------------------------------

function SidebarSection({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.section}>
      <Stack direction="column" gap={1.5}>
        {children}
      </Stack>
    </div>
  );
}

function SidebarField({
  label,
  children,
  labelId,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  labelId?: string;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.field}>
      <Label id={labelId} className={styles.fieldLabel}>
        {label}
      </Label>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  );
}

interface SeverityToggleOption {
  label: string;
  value: SeverityFilterValue;
  count?: number;
  /** The severity tier this option represents; drives its icon and color. Absent for "All". */
  severity?: QualitySeverity;
}

interface SeverityToggleGroupProps {
  options: SeverityToggleOption[];
  value: SeverityFilterValue;
  onChange: (value: SeverityFilterValue) => void;
  'aria-labelledby': string;
}

/** Single-select, radio-style vertical list used for the severity filter. */
function SeverityToggleGroup({ options, value, onChange, 'aria-labelledby': labelledBy }: SeverityToggleGroupProps) {
  const styles = useStyles2(getStyles);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy}>
      <Stack direction="column" gap={0.5}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={cx(styles.toggleButton, isActive && styles.toggleButtonActive)}
              onClick={() => onChange(option.value)}
            >
              {/* Color the icon and label together; Icon inherits the wrapper's currentColor. */}
              <span className={cx(styles.labelGroup, option.severity && styles.severityColor[option.severity])}>
                {option.severity && <Icon name={SEVERITY_ICONS[option.severity]} size="sm" aria-hidden />}
                <span className={styles.toggleButtonLabel}>{option.label}</span>
              </span>
              {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
            </button>
          );
        })}
      </Stack>
    </div>
  );
}

interface FindingTypeToggleProps {
  label: string;
  icon: IconName;
  count: number;
  isActive: boolean;
  onToggle: () => void;
}

/** Multiselect toggle row used for each finding type. */
function FindingTypeToggle({ label, icon, count, isActive, onToggle }: FindingTypeToggleProps) {
  const styles = useStyles2(getStyles);
  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={cx(styles.toggleButton, isActive && styles.toggleButtonActive)}
      onClick={onToggle}
    >
      <span className={styles.labelGroup}>
        <Icon name={icon} size="sm" aria-hidden />
        <span className={styles.toggleButtonLabel}>{label}</span>
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      width: SIDEBAR_WIDTH,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      paddingRight: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    clearButton: css({
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      color: theme.colors.text.link,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover:not(:disabled)': {
        textDecoration: 'underline',
      },
      '&:disabled': {
        color: theme.colors.text.disabled,
        cursor: 'default',
      },
    }),
    field: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    fieldLabel: css({
      marginBottom: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    fieldValue: css({
      position: 'relative',
    }),
    toggleButton: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(0.75),
      width: '100%',
      padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
      background: 'none',
      border: `1px solid transparent`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      textAlign: 'left',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    toggleButtonActive: css({
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
    }),
    labelGroup: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      minWidth: 0,
    }),
    severityColor: {
      high: css({ color: theme.visualization.getColorByName('red') }),
      medium: css({ color: theme.visualization.getColorByName('orange') }),
      low: css({ color: theme.visualization.getColorByName('yellow') }),
    },
    toggleButtonLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    count: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontVariantNumeric: 'tabular-nums',
    }),
  };
}
