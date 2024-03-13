import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { ScopesScene } from './ScopesScene';

export interface ScopesProps {
  scopes: ScopesScene;
}

export const Scopes = ({ scopes }: ScopesProps) => {
  const { filters, dashboards, isExpanded } = scopes.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, isExpanded && styles.containerExpanded)}>
      <div className={cx(styles.topContainer, isExpanded && styles.topContainerExpanded)}>
        <IconButton
          name="arrow-to-right"
          aria-label={isExpanded ? 'Collapse scope filters' : 'Expand scope filters'}
          className={cx(!isExpanded && styles.iconNotExpanded)}
          onClick={() => scopes.setIsExpanded(!isExpanded)}
        />
        <filters.Component model={filters} />
      </div>

      {isExpanded && <dashboards.Component model={dashboards} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      alignItems: 'baseline',
      flex: theme.spacing(40),
      gap: theme.spacing(1),
    }),
    containerExpanded: css({
      backgroundColor: theme.colors.background.primary,
    }),
    topContainer: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    topContainerExpanded: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    iconNotExpanded: css({
      transform: 'scaleX(-1)',
    }),
  };
};
