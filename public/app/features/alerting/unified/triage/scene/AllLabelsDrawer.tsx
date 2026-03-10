import { css, cx } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useSceneContext } from '@grafana/scenes-react';
import { Button, Drawer, IconButton, Stack, useStyles2 } from '@grafana/ui';

import { FiringCount, PendingCount } from './BadgeCounts';
import { type LabelStats, type LabelValueCount } from './useLabelsBreakdown';
import { addOrReplaceFilter, useExactFilterKeys, useFilterValue, useIsAnyFilter } from './utils';

// --- Public API ---

interface AllLabelsDrawerProps {
  allLabels: LabelStats[];
  onClose: () => void;
}

export const DEFAULT_VISIBLE_LABELS = 25;
export const DEFAULT_VISIBLE_VALUES = 12;

export function AllLabelsDrawer({ allLabels, onClose }: AllLabelsDrawerProps) {
  return (
    <Drawer title={t('alerting.triage.all-labels-drawer-title', 'All labels')} size="sm" onClose={onClose}>
      <AllLabelsContent allLabels={allLabels} onFilterAdded={onClose} />
    </Drawer>
  );
}

// --- Shared content component (also used by LabelsColumn) ---

export interface AllLabelsContentProps {
  allLabels: LabelStats[];
  /** Optional callback fired after a filter is added (e.g. to close a drawer) */
  onFilterAdded?: () => void;
  /** Optional text filter applied to label keys */
  labelFilter?: string;
}

export function AllLabelsContent({ allLabels, onFilterAdded, labelFilter = '' }: AllLabelsContentProps) {
  const styles = useStyles2(getContentStyles);
  const sceneContext = useSceneContext();
  const [showAll, setShowAll] = useState(false);

  // Explicit overrides set by the chevron toggle — take precedence over filter-driven state.
  const [forcedOpen, setForcedOpen] = useState<Set<string>>(new Set());
  const [forcedClosed, setForcedClosed] = useState<Set<string>>(new Set());
  const exactFilterKeys = useExactFilterKeys();

  const filteredLabels =
    labelFilter.trim() === ''
      ? allLabels
      : allLabels.filter((label) => label.key.toLowerCase().includes(labelFilter.toLowerCase()));
  const visibleLabels = showAll ? filteredLabels : filteredLabels.slice(0, DEFAULT_VISIBLE_LABELS);
  const hasMore = filteredLabels.length > DEFAULT_VISIBLE_LABELS;

  const handleValueClick = (key: string, value: string) => {
    addOrReplaceFilter(sceneContext, key, '=', value);
    // Clear any forced-closed override so the filter-driven open state takes effect.
    setForcedClosed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    onFilterAdded?.();
  };

  const handleKeyClick = (key: string) => {
    addOrReplaceFilter(sceneContext, key, '=~', '.+');
    onFilterAdded?.();
  };

  const toggleKey = (key: string, currentlyOpen: boolean) => {
    if (currentlyOpen) {
      setForcedOpen((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setForcedClosed((prev) => new Set(prev).add(key));
    } else {
      setForcedClosed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setForcedOpen((prev) => new Set(prev).add(key));
    }
  };

  return (
    <div className={styles.content}>
      {visibleLabels.map((label, index) => {
        const hasExactFilter = exactFilterKeys.has(label.key);
        // Forced overrides win; otherwise open when an exact-value filter is active.
        let isOpen = hasExactFilter;
        if (forcedClosed.has(label.key)) {
          isOpen = false;
        } else if (forcedOpen.has(label.key)) {
          isOpen = true;
        }
        return (
          <Fragment key={label.key}>
            {index > 0 && <div className={styles.sectionSeparator} />}
            <div className={styles.labelRow}>
              <Stack alignItems="center" gap={0} minWidth={0} grow={1}>
                <IconButton
                  className={styles.collapseToggle}
                  name={isOpen ? 'angle-down' : 'angle-right'}
                  size="sm"
                  aria-label={
                    isOpen ? t('alerting.triage.collapse', 'Collapse') : t('alerting.triage.expand', 'Expand')
                  }
                  onClick={() => toggleKey(label.key, isOpen)}
                />
                <Stack direction="row" gap={0.5} alignItems="center">
                  <LabelKeyButton labelKey={label.key} onClick={() => handleKeyClick(label.key)} />
                  <span className={styles.valueCount}>{label.values.length}</span>
                </Stack>
              </Stack>
              <Stack alignItems="center" gap={0.5} shrink={0}>
                {label.pending > 0 ? <PendingCount count={label.pending} /> : null}
                {label.firing > 0 ? <FiringCount count={label.firing} /> : null}
              </Stack>
            </div>
            {isOpen && (
              <LabelValuesList
                labelKey={label.key}
                values={label.values}
                onValueClick={(value) => handleValueClick(label.key, value)}
              />
            )}
          </Fragment>
        );
      })}
      {hasMore && !showAll && (
        <Button variant="secondary" size="sm" fill="text" onClick={() => setShowAll(true)}>
          <Trans
            i18nKey="alerting.triage.show-all-labels"
            values={{ count: allLabels.length }}
            defaults={'Show all ({{ count }})'}
          />
        </Button>
      )}
    </div>
  );
}

// --- Internal components ---

interface LabelKeyButtonProps {
  labelKey: string;
  onClick: () => void;
}

function LabelKeyButton({ labelKey, onClick }: LabelKeyButtonProps) {
  const styles = useStyles2(getContentStyles);
  const isActive = useIsAnyFilter(labelKey);

  return (
    <span className={styles.labelHeaderKey}>
      <Button
        variant="secondary"
        fill="text"
        size="sm"
        className={cx(styles.labelKeyButton, isActive && styles.activeButton)}
        onClick={onClick}
      >
        {labelKey}
      </Button>
    </span>
  );
}

interface LabelValuesListProps {
  labelKey: string;
  values: LabelValueCount[];
  onValueClick: (value: string) => void;
}

function LabelValuesList({ labelKey, values, onValueClick }: LabelValuesListProps) {
  const styles = useStyles2(getContentStyles);
  const [expanded, setExpanded] = useState(false);
  const activeValue = useFilterValue(labelKey);

  const visibleValues = expanded ? values : values.slice(0, DEFAULT_VISIBLE_VALUES);
  const hasMore = values.length > DEFAULT_VISIBLE_VALUES;

  return (
    <>
      {visibleValues.map(({ value, firing, pending }) => (
        <div key={value} className={styles.valueRow}>
          <Button
            variant="secondary"
            fill="text"
            size="sm"
            className={cx(styles.valueButton, activeValue === value && styles.activeButton)}
            onClick={() => onValueClick(value)}
          >
            {value}
          </Button>
          <Stack alignItems="center" gap={0.5} shrink={0}>
            {pending > 0 && <PendingCount count={pending} />}
            {firing > 0 && <FiringCount count={firing} />}
          </Stack>
        </div>
      ))}
      {hasMore && !expanded && (
        <Button variant="secondary" fill="text" size="sm" onClick={() => setExpanded(true)}>
          <Trans
            i18nKey="alerting.triage.show-all-values"
            values={{ count: values.length }}
            defaults={'Show all ({{ count }})'}
          />
        </Button>
      )}
      {hasMore && expanded && (
        <Button variant="secondary" fill="text" size="sm" onClick={() => setExpanded(false)}>
          <Trans i18nKey="alerting.triage.show-fewer-values" defaults="Show fewer" />
        </Button>
      )}
    </>
  );
}

// --- Styles ---

const getContentStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(1),
  }),
  sectionSeparator: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
  }),
  labelRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  valueRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  collapseToggle: css({
    margin: 0,
    flexShrink: 0,
  }),
  labelHeaderKey: css({
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  }),
  labelKeyButton: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.secondary,
    minWidth: 0,
    '& > span': {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      display: 'block',
      minWidth: 0,
    },
  }),
  activeButton: css({
    background: theme.colors.action.selected,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  valueCount: css({
    flexShrink: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
  }),

  valueButton: css({
    flex: 1,
    minWidth: 0,
    justifySelf: 'stretch',
    '& > span': {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      display: 'block',
      minWidth: 0,
    },
  }),
});
