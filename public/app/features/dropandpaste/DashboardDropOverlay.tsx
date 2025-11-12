import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Text } from '@grafana/ui';

import { AddFileIcon } from './add-file-icon';

export function DashboardDropOverlay() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.dropOverlay}>
      <div className={styles.dropHint}>
        <div className={styles.icon}>
          <AddFileIcon />
        </div>
        <Text variant="body" element="p">
          <Trans i18nKey="dragndrop.drop-hover-text">Drop a file to bring your data into the dashboard</Trans>
        </Text>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dropOverlay: css({
      display: 'flex',
      backdropFilter: 'blur(2px)',
      position: 'absolute',
      zIndex: theme.zIndex.modal,
      inset: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: theme.spacing(10),
    }),
    dropHint: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      p: {
        fontSize: '1.5rem',
      },
    }),
    icon: css({
      width: '3rem',
    }),
  };
}
