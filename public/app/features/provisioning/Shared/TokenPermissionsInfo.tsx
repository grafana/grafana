import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { TextLink, useStyles2 } from '@grafana/ui';

export function TokenPermissionsInfo() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div>
        Go to{' '}
        <TextLink external href="https://github.com/settings/personal-access-tokens/new">
          GitHub Personal Access Tokens
        </TextLink>
        . Make sure to include these permissions under <b>Repository</b>:
      </div>

      <table className={styles.permissionTable}>
        <tbody>
          <tr className={styles.headerSeparator}>
            <th>Permission</th>
            <th>Access</th>
          </tr>
          <tr>
            <td>Contents</td>
            <td>Read and write</td>
          </tr>
          <tr>
            <td>Metadata</td>
            <td>Read-only</td>
          </tr>
          <tr>
            <td>Pull requests</td>
            <td>Read and write</td>
          </tr>
          <tr>
            <td>Webhooks</td>
            <td>Read and write</td>
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
