import { css, cx } from '@emotion/css';
import { Fragment, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useSceneContext } from '@grafana/scenes-react';
import { Button, IconButton, Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { FiringCount, PendingCount } from '../BadgeCounts';
import { type LabelStats, type LabelValueCount } from '../useLabelsBreakdown';
import { addOrReplaceFilter, removeFilter, useExactFilterKeys, useFilterValue, useIsAnyFilter } from '../utils';

import { useLabelSectionOpen } from './labelFilter.hooks';
import { filterLabels } from './labelFilter.utils';

export const DEFAULT_VISIBLE_LABELS = 25;
export const DEFAULT_VISIBLE_VALUES = 12;

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

  const exactFilterKeys = useExactFilterKeys();
  const { filteredLabels, valueMatchKeys, valueHitMap } = useMemo(
    () => filterLabels(allLabels, labelFilter),
    [allLabels, labelFilter]
  );
  const sectionOpen = useLabelSectionOpen(exactFilterKeys, valueMatchKeys);

  const visibleLabels = showAll ? filteredLabels : filteredLabels.slice(0, DEFAULT_VISIBLE_LABELS);
  const hasMore = filteredLabels.length > DEFAULT_VISIBLE_LABELS;

  const handleLabelValueClick = (key: string, value: string, isActive: boolean) => {
    if (isActive) {
      removeFilter(sceneContext, key);
    } else {
      addOrReplaceFilter(sceneContext, key, '=', value);
      // Clear any forced-closed override so the filter-driven open state takes effect.
      sectionOpen.clearForcedClosed(key);
      onFilterAdded?.();
    }
  };

  const handleLabelKeyClick = (key: string, isActive: boolean) => {
    if (isActive) {
      removeFilter(sceneContext, key);
    } else {
      addOrReplaceFilter(sceneContext, key, '=~', '.+');
      onFilterAdded?.();
    }
  };

  return (
    <div className={styles.content}>
      {visibleLabels.map((label, index) => {
        const isOpen = sectionOpen.isOpen(label.key);
        return (
          <Fragment key={label.key}>
            <div className={styles.labelRow}>
              <Stack alignItems="center" gap={0} minWidth={0} grow={1}>
                <IconButton
                  className={styles.collapseToggle}
                  name={isOpen ? 'angle-down' : 'angle-right'}
                  size="sm"
                  aria-label={
                    isOpen ? t('alerting.triage.collapse', 'Collapse') : t('alerting.triage.expand', 'Expand')
                  }
                  onClick={() => sectionOpen.toggle(label.key)}
                />
                <Stack direction="row" gap={0.5} alignItems="center" minWidth={0}>
                  <LabelKeyButton
                    labelKey={label.key}
                    onClick={(isActive) => handleLabelKeyClick(label.key, isActive)}
                  />
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
                valueHits={valueHitMap.get(label.key)}
                onValueClick={(value, isActive) => handleLabelValueClick(label.key, value, isActive)}
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

interface LabelKeyButtonProps {
  labelKey: string;
  onClick: (isActive: boolean) => void;
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
        onClick={() => onClick(isActive)}
      >
        {labelKey}
      </Button>
    </span>
  );
}

interface LabelValuesListProps {
  labelKey: string;
  values: LabelValueCount[];
  onValueClick: (value: string, isActive: boolean) => void;
  /** When provided, only values at these indices are shown (value-level filter match). */
  valueHits?: Set<number>;
}

function LabelValuesList({ labelKey, values, onValueClick, valueHits }: LabelValuesListProps) {
  const styles = useStyles2(getContentStyles);
  const [expanded, setExpanded] = useState(false);
  const activeValue = useFilterValue(labelKey);

  const matchedValues = valueHits ? values.filter((_, i) => valueHits.has(i)) : values;
  const visibleValues = expanded ? matchedValues : matchedValues.slice(0, DEFAULT_VISIBLE_VALUES);
  const hasMore = matchedValues.length > DEFAULT_VISIBLE_VALUES;

  return (
    <Stack direction="column" alignItems="stretch" gap={0}>
      {visibleValues.map(({ value, firing, pending }) => (
        <div key={value} className={styles.valueRow}>
          <Button
            variant="secondary"
            fill="text"
            size="sm"
            className={cx(styles.valueButton, activeValue === value && styles.activeButton)}
            onClick={() => onValueClick(value, activeValue === value)}
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
            values={{ count: matchedValues.length }}
            defaults={'Show all ({{ count }})'}
          />
        </Button>
      )}
      {hasMore && expanded && (
        <Button variant="secondary" fill="text" size="sm" onClick={() => setExpanded(false)}>
          <Trans i18nKey="alerting.triage.show-fewer-values" defaults="Show fewer" />
        </Button>
      )}
    </Stack>
  );
}

// --- Styles ---

const getContentStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(1),
    gap: theme.spacing(0.5),
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
    paddingLeft: theme.spacing(1),
    marginLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
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
