import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useSceneContext } from '@grafana/scenes-react';
import { Button, Drawer, useStyles2 } from '@grafana/ui';

import { FiringCount, PendingCount } from './BadgeCounts';
import { type LabelStats, type LabelValueCount } from './useLabelsBreakdown';
import { addOrReplaceFilter } from './utils';

// --- Public API ---

interface AllLabelsDrawerProps {
  allLabels: LabelStats[];
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
            {label.pending > 0 ? <PendingCount count={label.pending} /> : <span />}
            {label.firing > 0 ? <FiringCount count={label.firing} /> : <span />}
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
          {pending > 0 ? <PendingCount count={pending} /> : <span />}
          {firing > 0 ? <FiringCount count={firing} /> : <span />}
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
