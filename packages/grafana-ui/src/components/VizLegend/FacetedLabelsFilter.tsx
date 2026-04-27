import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { FIELD_NAME_FACET_KEY } from '@grafana/data/utils';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Checkbox } from '../Forms/Checkbox';
import { Icon } from '../Icon/Icon';

export interface FacetedLabelsFilterProps {
  /** Map of label keys to their sorted unique values, from extractFacetedLabels */
  labels: Record<string, string[]>;
  /** Currently selected label values, keyed by label key */
  selected: Record<string, string[]>;
  /** Called when the selection changes */
  onChange: (selected: Record<string, string[]>) => void;
  /** When true the filter is dimmed to indicate the legend has taken precedence */
  dimmed?: boolean;
}

export function FacetedLabelsFilter({ labels, selected, onChange, dimmed }: FacetedLabelsFilterProps) {
  const styles = useStyles2(getStyles);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const labelKeys = Object.keys(labels);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleValue = useCallback(
    (key: string, value: string) => {
      const current = selected[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

      onChange({ ...selected, [key]: next });
    },
    [selected, onChange]
  );

  const toggleAllForKey = useCallback(
    (key: string) => {
      const values = labels[key];
      if (!values) {
        return;
      }
      const current = selected[key] ?? [];
      const allSelected = current.length === values.length;
      onChange({ ...selected, [key]: allSelected ? [] : [...values] });
    },
    [labels, selected, onChange]
  );

  const seriesValues = labels[FIELD_NAME_FACET_KEY];
  const realLabelKeys = labelKeys.filter((key) => key !== FIELD_NAME_FACET_KEY);

  if (!seriesValues && realLabelKeys.length === 0) {
    return null;
  }

  const renderCheckboxList = (key: string, values: string[], className: string) => {
    const selectedValues = selected[key] ?? [];
    return (
      <div className={className}>
        {values.map((value) => (
          <Checkbox
            key={value}
            label={value}
            value={selectedValues.includes(value)}
            onChange={() => toggleValue(key, value)}
            className={styles.checkbox}
          />
        ))}
        <button type="button" className={styles.toggleAll} onClick={() => toggleAllForKey(key)}>
          {selectedValues.length === values.length ? (
            <Trans i18nKey="grafana-ui.viz-legend.faceted-deselect-all">Deselect all</Trans>
          ) : (
            <Trans i18nKey="grafana-ui.viz-legend.faceted-select-all">Select all</Trans>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className={cx(styles.container, dimmed && styles.dimmed)} data-testid="faceted-labels-filter">
      {seriesValues && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>
            <Trans i18nKey="grafana-ui.viz-legend.faceted-by-name">By name</Trans>
          </span>
          {renderCheckboxList(FIELD_NAME_FACET_KEY, seriesValues, styles.checkboxList)}
        </div>
      )}

      {realLabelKeys.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>
            <Trans i18nKey="grafana-ui.viz-legend.faceted-by-labels">By labels</Trans>
          </span>
          {realLabelKeys.map((key) => {
            const selectedValues = selected[key] ?? [];
            const isExpanded = expandedKeys[key] ?? false;
            return (
              <div key={key} className={styles.labelGroup}>
                <button type="button" className={styles.labelKey} onClick={() => toggleExpanded(key)}>
                  <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="sm" />
                  <span className={styles.keyName}>{key}</span>
                  {selectedValues.length > 0 && <span className={styles.count}>{selectedValues.length}</span>}
                </button>
                {isExpanded && renderCheckboxList(key, labels[key], styles.checkboxListIndented)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

FacetedLabelsFilter.displayName = 'FacetedLabelsFilter';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: '150px',
    padding: theme.spacing(1.5, 1, 1, 1),
    gap: theme.spacing(1),
  }),
  dimmed: css({
    opacity: 0.5,
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  sectionLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.25),
  }),
  toggleAll: css({
    all: 'unset',
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.link,
    marginTop: theme.spacing(0.25),
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  labelGroup: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  labelKey: css({
    all: 'unset',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
    padding: theme.spacing(0.25, 0),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
  keyName: css({
    fontWeight: theme.typography.fontWeightMedium,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  count: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  checkboxList: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0, 0, 0.5, 0.5),
  }),
  checkboxListIndented: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0, 0, 0.5, 2.5),
  }),
  checkbox: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});
