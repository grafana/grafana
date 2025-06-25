import { css } from '@emotion/css';

import { GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';

interface Props {
  libraryPanel: LibraryPanelBehavior;
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
        <Trans i18nKey="dashboard-scene.library-viz-panel-info.usage-count" count={meta.connectedDashboards}>
          Used on {'{{count}}'} dashboards
        </Trans>
      </div>
      <div className={styles.libraryPanelInfo}>
        <Trans
          i18nKey="dashboard-scene.library-viz-panel-info.last-edited"
          values={{ timeAgo: dateTimeFormat(meta.updated, { format: 'L', timeZone: tz }) }}
          components={{
            person: (
              <>
                {meta.updatedBy.avatarUrl && (
                  <img
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
          {'{{timeAgo}}'} by
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
