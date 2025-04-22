import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export function TokenPermissionsInfo() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {/* GitHub UI is English only, so these strings are not translated */}
      {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
      <Stack gap={0.5} wrap={'wrap'}>
        <Trans i18nKey="provisioning.token-permissions-info.go-to">Go to</Trans>
        <TextLink external href="https://github.com/settings/personal-access-tokens/new">
          GitHub Personal Access Tokens
        </TextLink>
        <Trans i18nKey="provisioning.token-permissions-info.and-click">and click</Trans>
        <strong>"Fine-grained token".</strong>
        <Trans i18nKey="provisioning.token-permissions-info.make-sure">Make sure to include these permissions</Trans>:
      </Stack>

      <ul className={styles.permissionsList}>
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <li>
          Content: <span className={styles.accessLevel}>Read and write</span>
        </li>
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <li>
          Metadata: <span className={styles.accessLevel}>Read only</span>
        </li>
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <li>
          Pull requests: <span className={styles.accessLevel}>Read and write</span>
        </li>
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <li>
          Webhooks: <span className={styles.accessLevel}>Read and write</span>
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
