import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';

interface Props {
  libraryPanel: LibraryVizPanel;
}

export const LibraryVizPanelInfo = ({ libraryPanel }: Props) => {
  const styles = useStyles2(getStyles);

  const libraryPanelState = libraryPanel.useState();
  const tz = libraryPanelState.$timeRange?.getTimeZone();
  const meta = libraryPanelState._loadedPanel?.meta;
  if (!meta) {
    return null;
  }

  return (
    <div className={styles.info}>
      <div className={styles.libraryPanelInfo}>
        {`Used on ${meta.connectedDashboards} `}
        {meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'}
      </div>
      <div className={styles.libraryPanelInfo}>
        {dateTimeFormat(meta.updated, { format: 'L', timeZone: tz })} by
        {meta.updatedBy.avatarUrl && (
          <img className={styles.userAvatar} src={meta.updatedBy.avatarUrl} alt={`Avatar for ${meta.updatedBy.name}`} />
        )}
        {meta.updatedBy.name}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    info: css({
      lineHeight: 1,
    }),
    libraryPanelInfo: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    userAvatar: css({
      borderRadius: theme.shape.radius.circle,
      boxSizing: 'content-box',
      width: '22px',
      height: '22px',
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    }),
  };
};
