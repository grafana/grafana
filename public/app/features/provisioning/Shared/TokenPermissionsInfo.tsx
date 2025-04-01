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
          </TextLink>
          . Make sure to include these permissions under <b>Repository</b>:
        </Trans>
      </div>

      <table className={styles.permissionTable}>
        <tbody>
          <tr className={styles.headerSeparator}>
            <th>
              <Trans i18nKey="provisioning.token-permissions-info.permission">Permission</Trans>
            </th>
            <th>
              <Trans i18nKey="provisioning.token-permissions-info.access">Access</Trans>
            </th>
          </tr>
          <tr>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.contents">Contents</Trans>
            </td>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.read-and-write">Read and write</Trans>
            </td>
          </tr>
          <tr>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.metadata">Metadata</Trans>
            </td>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.readonly">Read-only</Trans>
            </td>
          </tr>
          <tr>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.pull-requests">Pull requests</Trans>
            </td>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.read-and-write">Read and write</Trans>
            </td>
          </tr>
          <tr>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.webhooks">Webhooks</Trans>
            </td>
            <td>
              <Trans i18nKey="provisioning.token-permissions-info.read-and-write">Read and write</Trans>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginBottom: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      position: 'relative',
      borderRadius: theme.shape.radius.default,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      padding: theme.spacing(theme.components.panel.padding),
    }),
    permissionTable: css({
      tableLayout: 'auto',
      width: '40%',
    }),
    headerSeparator: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
