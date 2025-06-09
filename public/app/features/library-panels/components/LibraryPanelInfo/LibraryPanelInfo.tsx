import { css } from '@emotion/css';

import { DateTimeInput, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
        <Trans i18nKey="library-panels.library-panel-info.usage-count" count={meta.connectedDashboards}>
          Used on {'{{count}}'} dashboards
        </Trans>
      </div>
      <div className={styles.libraryPanelInfo}>
        <Trans
          i18nKey="library-panels.library-panel-info.last-edited"
          values={{ timeAgo: formatDate?.(meta.updated, 'L') ?? meta.updated }}
          components={{
            person: (
              <>
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
              </>
            ),
          }}
        >
          Last edited on {'{{timeAgo}}'} by
          {'<person />'}
        </Trans>
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
