import { css } from '@emotion/css';
import React from 'react';

import { DateTimeInput, GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

import { isPanelModelLibraryPanel } from '../../guard';
import { PanelModelWithLibraryPanel } from '../../types';

interface Props {
  panel: PanelModelWithLibraryPanel;
  formatDate?: (dateString: DateTimeInput, format?: string) => string;
}

export const LibraryPanelInformation = ({ panel, formatDate }: Props) => {
  const styles = useStyles(getStyles);

  if (!isPanelModelLibraryPanel(panel)) {
    return null;
  }

  return (
    <div className={styles.info}>
      <div className={styles.libraryPanelInfo}>
        {`Used on ${panel.libraryPanel.meta.connectedDashboards} `}
        {panel.libraryPanel.meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'}
      </div>
      <div className={styles.libraryPanelInfo}>
        Last edited on {formatDate?.(panel.libraryPanel.meta.updated, 'L') ?? panel.libraryPanel.meta.updated} by
        {panel.libraryPanel.meta.updatedBy.avatarUrl && (
          <img
            width="22"
            height="22"
            className={styles.userAvatar}
            src={panel.libraryPanel.meta.updatedBy.avatarUrl}
            alt={`Avatar for ${panel.libraryPanel.meta.updatedBy.name}`}
          />
        )}
        {panel.libraryPanel.meta.updatedBy.name}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    info: css`
      line-height: 1;
    `,
    libraryPanelInfo: css`
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.sm};
    `,
    userAvatar: css`
      border-radius: 50%;
      box-sizing: content-box;
      width: 22px;
      height: 22px;
      padding-left: ${theme.spacing.sm};
      padding-right: ${theme.spacing.sm};
    `,
  };
};
