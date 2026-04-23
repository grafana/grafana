import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { LinkButton, Stack, useStyles2 } from '@grafana/ui';

export function PageHeader() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.title}>
          <Trans i18nKey="alerting.rule-list-v2.title">Alert rules</Trans>
        </h1>
        <p className={styles.subtitle}>
          <Trans i18nKey="alerting.rule-list-v2.subtitle">
            Organized by folder and evaluation group — the way rules actually evaluate
          </Trans>
        </p>
      </div>
      <Stack direction="row" gap={1}>
        <LinkButton variant="secondary" icon="import" href="#">
          <Trans i18nKey="alerting.rule-list-v2.import-export">Import / export</Trans>
        </LinkButton>
        <LinkButton variant="primary" icon="plus" href="/alerting/new/alerting">
          <Trans i18nKey="alerting.rule-list-v2.new-rule">New rule in folder</Trans>
        </LinkButton>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      padding: theme.spacing(2, 2, 1, 2),
    }),
    title: css({
      margin: 0,
      marginBottom: theme.spacing(0.5),
      fontSize: theme.typography.h1.fontSize,
    }),
    subtitle: css({
      margin: 0,
      color: theme.colors.text.secondary,
    }),
  };
}
