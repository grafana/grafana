import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export function TokenPermissionsInfo() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div>
        <Trans i18nKey="provisioning.token-permissions-info.github-instructions">
          Go to{' '}
          <TextLink external href="https://github.com/settings/personal-access-tokens/new">
            GitHub Personal Access Tokens
          </TextLink>{' '}
          and click <strong>"Fine-grained token"</strong>. Make sure to include these permissions:
        </Trans>
      </div>

      <ul className={styles.permissionsList}>
        <li>
          <Trans i18nKey="provisioning.token-permissions-info.content-permission">
            Content: <span className={styles.accessLevel}>Read and write</span>
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.token-permissions-info.metadata-permission">
            Metadata: <span className={styles.accessLevel}>Read only</span>
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.token-permissions-info.pull-requests-permission">
            Pull requests: <span className={styles.accessLevel}>Read and write</span>
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.token-permissions-info.webhooks-permission">
            Webhooks: <span className={styles.accessLevel}>Read and write</span>
          </Trans>
        </li>
      </ul>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginBottom: theme.spacing(1),
      position: 'relative',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      padding: theme.spacing(theme.components.panel.padding),
    }),
    permissionsList: css({
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(3),

      li: css({
        marginBottom: theme.spacing(1),
      }),
    }),
    accessLevel: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      background: '#22262B',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.25, 0.5),
    }),
  };
}
