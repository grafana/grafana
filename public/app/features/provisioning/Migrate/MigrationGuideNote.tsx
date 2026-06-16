import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, TextLink, useStyles2 } from '@grafana/ui';

import { CONFIGURE_GRAFANA_DOCS_URL } from '../constants';

/** Interim note shown on the Migrate tab while the guided workflow is built. */
export function MigrationGuideNote() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.intro}>
      <Text color="secondary">
        <Trans i18nKey="provisioning.migrate.intro">
          The guided migration workflow is on its way. In the meantime, read the{' '}
          <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL}>
            provisioning documentation
          </TextLink>{' '}
          to learn how Git Sync keeps Grafana and your repository in step.
        </Trans>
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  intro: css({
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
});
