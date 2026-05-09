import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const INSTALL_PATH = `/plugins/${ASSISTANT_PLUGIN_ID}`;

export default function AssistantOnboardingPage() {
  const styles = useStyles2(getStyles);

  const onInstallClick = () => {
    reportInteraction('assistant_onboarding_install_clicked', {
      plugin_id: ASSISTANT_PLUGIN_ID,
    });
  };

  return (
    <Stack direction="column" alignItems="center" gap={4}>
      <div className={styles.hero}>
        <Icon name="ai-sparkle" size="xxxl" className={styles.heroIcon} />
        <Text element="h1" textAlignment="center" variant="h1">
          <Trans i18nKey="assistant-onboarding.heading">Grafana Assistant</Trans>
        </Text>
        <Text element="p" textAlignment="center" color="secondary" variant="body">
          <Trans i18nKey="assistant-onboarding.description">
            A purpose-built AI assistant for Grafana that helps you query metrics, investigate alerts, analyze logs and
            traces, and navigate your data through natural language.
          </Trans>
        </Text>
      </div>

      <Box>
        <LinkButton href={INSTALL_PATH} icon="plus-circle" size="lg" onClick={onInstallClick}>
          <Trans i18nKey="assistant-onboarding.install-cta">Install Grafana Assistant</Trans>
        </LinkButton>
      </Box>

      <Text element="p" color="secondary" variant="bodySmall">
        <Trans i18nKey="assistant-onboarding.subnote">
          The Assistant is delivered as a Grafana plugin. Once installed, you&apos;ll connect it to Grafana Cloud to get
          started.
        </Trans>
      </Text>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  hero: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(6),
    maxWidth: '640px',
  }),
  heroIcon: css({
    color: theme.colors.primary.text,
  }),
});
