import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { VAR_FILTERS_EXPR } from './shared';

export interface Props {
  trail: DataTrail;
  onSelect: (trail: DataTrail) => void;
}

export function DataTrailCard({ trail, onSelect }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <button className={styles.container} onClick={() => onSelect(trail)}>
      <div className={styles.heading}>{trail.state.metric}</div>
      <div className={styles.body}>{sceneGraph.interpolate(trail, VAR_FILTERS_EXPR)}</div>
    </button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(1),
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      boxShadow: 'none',
      background: 'transparent',
    }),
    heading: css({
      padding: theme.spacing(0),
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    body: css({
      padding: theme.spacing(0),
    }),
  };
}
