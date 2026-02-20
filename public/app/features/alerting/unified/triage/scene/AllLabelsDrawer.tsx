import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { AdHocFiltersVariable, SceneObject, sceneGraph } from '@grafana/scenes';
import { useSceneContext } from '@grafana/scenes-react';
import { Button, Drawer, Icon, useStyles2 } from '@grafana/ui';

import { VARIABLES } from '../constants';

import { type LabelValueCount, type TopLabel } from './useLabelsBreakdown';

// --- Public API ---

interface AllLabelsDrawerProps {
  allLabels: TopLabel[];
  onClose: () => void;
}

const DEFAULT_VISIBLE_LABELS = 12;
const DEFAULT_VISIBLE_VALUES = 12;

export function AllLabelsDrawer({ allLabels, onClose }: AllLabelsDrawerProps) {
  const styles = useStyles2(getDrawerStyles);
  const sceneContext = useSceneContext();
  const [showAll, setShowAll] = useState(false);

  const visibleLabels = showAll ? allLabels : allLabels.slice(0, DEFAULT_VISIBLE_LABELS);
  const hasMore = allLabels.length > DEFAULT_VISIBLE_LABELS;

  const handleValueClick = (key: string, value: string) => {
    addOrReplaceFilter(sceneContext, key, '=', value);
    onClose();
  };

  const handleKeyClick = (key: string) => {
    addOrReplaceFilter(sceneContext, key, '=~', '.+');
    onClose();
  };

  return (
    <Drawer title={t('alerting.triage.all-labels-drawer-title', 'All labels')} size="sm" onClose={onClose}>
      <div className={styles.drawerContent}>
        {visibleLabels.map((label, index) => (
          <Fragment key={label.key}>
            {index > 0 && <div className={styles.sectionSeparator} />}
            <span className={styles.labelHeaderKey}>
              <Button
                variant="secondary"
                fill="text"
                className={styles.labelKeyButton}
                onClick={() => handleKeyClick(label.key)}
              >
                {label.key}
              </Button>
              <span className={styles.labelCount}>
                <Trans
                  i18nKey="alerting.triage.label-instance-count"
                  values={{ count: label.count }}
                  defaults={'({{ count }} instances)'}
                />
              </span>
            </span>
            <span className={styles.headerColPending}>
              <PendingCount count={label.pending} />
            </span>
            <span className={styles.headerColFiring}>
              <FiringCount count={label.firing} />
            </span>
            <LabelValuesList values={label.values} onValueClick={(value) => handleValueClick(label.key, value)} />
          </Fragment>
        ))}
        {hasMore && !showAll && (
          <Button variant="secondary" fill="text" className={styles.spanAllColumns} onClick={() => setShowAll(true)}>
            <Trans
              i18nKey="alerting.triage.show-all-labels"
              values={{ count: allLabels.length }}
              defaults={'Show all ({{ count }})'}
            />
          </Button>
        )}
      </div>
    </Drawer>
  );
}

// --- Shared components ---

export function FiringCount({ count }: { count: number }) {
  const styles = useStyles2(getLabelBadgeCountStyles);
  if (count === 0) {
    return null;
  }
  return (
    <span className={styles.firingCount}>
      <Icon name="exclamation-circle" size="xs" />
      {count}
    </span>
  );
}

export function PendingCount({ count }: { count: number }) {
  const styles = useStyles2(getLabelBadgeCountStyles);
  if (count === 0) {
    return null;
  }
  return (
    <span className={styles.pendingCount}>
      <Icon name="circle" size="xs" />
      {count}
    </span>
  );
}

export function LabelBadgeCounts({ firing, pending }: { firing: number; pending: number }) {
  const styles = useStyles2(getLabelBadgeCountStyles);
  return (
    <span className={styles.counts}>
      <FiringCount count={firing} />
      <PendingCount count={pending} />
    </span>
  );
}

export function addOrReplaceFilter(sceneContext: SceneObject, key: string, operator: string, value: string) {
  const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (filtersVariable instanceof AdHocFiltersVariable) {
    const currentFilters = filtersVariable.state.filters;
    const existingIndex = currentFilters.findIndex((f) => f.key === key);
    const newFilter = { key, operator, value };
    const updatedFilters =
      existingIndex >= 0
        ? currentFilters.map((f, i) => (i === existingIndex ? newFilter : f))
        : [...currentFilters, newFilter];
    filtersVariable.setState({ filters: updatedFilters });
  }
}

// --- Internal components ---

interface LabelValuesListProps {
  values: LabelValueCount[];
  onValueClick: (value: string) => void;
}

function LabelValuesList({ values, onValueClick }: LabelValuesListProps) {
  const styles = useStyles2(getDrawerStyles);
  const [expanded, setExpanded] = useState(false);

  const visibleValues = expanded ? values : values.slice(0, DEFAULT_VISIBLE_VALUES);
  const hasMore = values.length > DEFAULT_VISIBLE_VALUES;

  return (
    <>
      {visibleValues.map(({ value, firing, pending }) => (
        <Fragment key={value}>
          <Button
            variant="secondary"
            fill="text"
            size="sm"
            className={styles.valueButton}
            onClick={() => onValueClick(value)}
          >
            {value}
          </Button>
          <span className={styles.valueColPending}>
            <PendingCount count={pending} />
          </span>
          <span className={styles.valueColFiring}>
            <FiringCount count={firing} />
          </span>
        </Fragment>
      ))}
      {hasMore && !expanded && (
        <Button variant="secondary" fill="text" className={styles.spanAllColumns} onClick={() => setExpanded(true)}>
          <Trans
            i18nKey="alerting.triage.show-all-values"
            values={{ count: values.length }}
            defaults={'Show all ({{ count }})'}
          />
        </Button>
      )}
    </>
  );
}

// --- Styles ---

export const getLabelBadgeCountStyles = (theme: GrafanaTheme2) => ({
  counts: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  firingCount: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.error.text,
  }),
  pendingCount: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.warning.text,
  }),
});

const getDrawerStyles = (theme: GrafanaTheme2) => ({
  drawerContent: css({
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(2)} minmax(0, 1fr) max-content max-content`,
    alignItems: 'center',
    rowGap: theme.spacing(0.25),
    columnGap: theme.spacing(1),
  }),
  sectionSeparator: css({
    gridColumn: '1 / -1',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
  }),
  labelHeaderKey: css({
    gridColumn: '1 / 3',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  labelCount: css({
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  headerColPending: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.warning.text,
    justifySelf: 'end',
    fontVariantNumeric: 'tabular-nums',
  }),
  headerColFiring: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.error.text,
    justifySelf: 'end',
    fontVariantNumeric: 'tabular-nums',
  }),
  labelKeyButton: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  valueColPending: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.warning.text,
    justifySelf: 'end',
    fontVariantNumeric: 'tabular-nums',
  }),
  valueColFiring: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    color: theme.colors.error.text,
    justifySelf: 'end',
    fontVariantNumeric: 'tabular-nums',
  }),
  spanAllColumns: css({
    gridColumn: '1 / -1',
  }),
  valueButton: css({
    gridColumn: '2',
    minWidth: 0,
    '& > span': {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      display: 'block',
      minWidth: 0,
    },
  }),
});
