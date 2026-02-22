import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { AdHocFiltersVariable, SceneObject, sceneGraph } from '@grafana/scenes';
import { useSceneContext } from '@grafana/scenes-react';
import { Button, Drawer, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { VARIABLES } from '../constants';

import { type LabelValueCount, type TopLabel } from './useLabelsBreakdown';

// --- Public API ---

interface AllLabelsDrawerProps {
  allLabels: TopLabel[];
  onClose: () => void;
}

const DEFAULT_VISIBLE_LABELS = 24;
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
            </span>
            <PendingCount count={label.pending} />
            <FiringCount count={label.firing} />
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
  if (count === 0) {
    return <span />;
  }
  return (
    <Text color="error" tabular>
      <Stack direction="row" gap={0.25} alignItems="center">
        <Icon name="exclamation-circle" size="xs" />
        {count}
      </Stack>
    </Text>
  );
}

export function PendingCount({ count }: { count: number }) {
  if (count === 0) {
    return <span />;
  }
  return (
    <Text color="warning" tabular>
      <Stack direction="row" gap={0.25} alignItems="center">
        <Icon name="circle" size="xs" />
        {count}
      </Stack>
    </Text>
  );
}

export function LabelBadgeCounts({ firing, pending }: { firing: number; pending: number }) {
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <FiringCount count={firing} />
      <PendingCount count={pending} />
    </Stack>
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
          <PendingCount count={pending} />
          <FiringCount count={firing} />
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

const getDrawerStyles = (theme: GrafanaTheme2) => ({
  drawerContent: css({
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(2)} minmax(0, 1fr) max-content max-content`,
    alignItems: 'center',
    justifyItems: 'end',
    rowGap: theme.spacing(0.25),
    columnGap: theme.spacing(1),
  }),
  sectionSeparator: css({
    gridColumn: '1 / -1',
    justifySelf: 'stretch',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
  }),
  labelHeaderKey: css({
    gridColumn: '1 / 3',
    justifySelf: 'start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  labelKeyButton: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  spanAllColumns: css({
    gridColumn: '1 / -1',
    justifySelf: 'start',
  }),
  valueButton: css({
    gridColumn: '2',
    justifySelf: 'stretch',
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
