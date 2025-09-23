import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { getTrailStore } from './TrailStore/TrailStore';

type Props = { onSelect: (trail: DataTrail) => void };

export function DataTrailsRecentMetrics({ onSelect }: Props) {
  const styles = useStyles2(getStyles);
  const recentMetrics = getTrailStore().recent;
  const theme = useTheme2();

  const [showAll, setShowAll] = useState(false);
  const handleToggleShow = () => {
    setShowAll(!showAll);
  };

  if (recentMetrics.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.recentExplorationHeader}>
        <div className={styles.header}>
          <Trans i18nKey="trails.recent-metrics.or-view-a-recent-exploration">Or view a recent exploration</Trans>
        </div>
      </div>
      <div className={css(styles.trailList, styles.bottomGap24)}>
        {getTrailStore()
          .recent.slice(0, showAll ? recentMetrics.length : 3)
          .map((trail, index) => {
            const resolvedTrail = trail.resolve();
            return (
              <DataTrailCard
                key={(resolvedTrail.state.key || '') + index}
                trail={resolvedTrail}
                onSelect={() => onSelect(resolvedTrail)}
              />
            );
          })}
      </div>
      {recentMetrics.length > 3 && (
        <Button variant="secondary" size="sm" onClick={handleToggleShow} fill={theme.isLight ? 'outline' : 'solid'}>
          {showAll ? 'Show less' : 'Show more'}
        </Button>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    recentExplorationHeader: css({
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(3),
    }),
    header: css({
      color: theme.colors.text.primary,
      textAlign: 'center',
      fontSize: '18px',
      fontWeight: '400',
      letterSpacing: '0.045px',
    }),
    trailList: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: `${theme.spacing(4)}`,
      alignItems: 'stretch',
      justifyItems: 'center',
    }),
    bottomGap24: css({
      marginBottom: theme.spacing(3),
    }),
  };
}
