import { css } from '@emotion/css';

import { DateTimeInput, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PanelModelWithLibraryPanel } from '../../types';

interface Props {
  panel: PanelModelWithLibraryPanel;
  formatDate?: (dateString: DateTimeInput, format?: string) => string;
}

export const LibraryPanelInformation = ({ panel, formatDate }: Props) => {
  const styles = useStyles2(getStyles);

  const meta = panel.libraryPanel?.meta;
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
        Last edited on {formatDate?.(meta.updated, 'L') ?? meta.updated} by
        {meta.updatedBy.avatarUrl && (
          <img
            width="22"
            height="22"
            className={styles.userAvatar}
            src={meta.updatedBy.avatarUrl}
            alt={`Avatar for ${meta.updatedBy.name}`}
          />
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
