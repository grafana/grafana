import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

interface StPodErrorCardProps {
  pageTitle?: string;
}

const SUPPORT_EMAIL = 'support@grafana.com';

export const StPodErrorCard = ({ pageTitle }: StPodErrorCardProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div data-testid="st-pod-error-card" className={styles.card} role="alert">
        <Icon name="exclamation-triangle" size="xxl" className={styles.icon} />
        <Stack direction="column" alignItems="center" gap={1}>
          <Text variant="h4" textAlignment="center">
            {pageTitle
              ? t('st-pod-ready.error.title', "Couldn't load {{pageTitle}}", { pageTitle })
              : t('st-pod-ready.error.title-fallback', "Couldn't load page")}
          </Text>
          <Text color="secondary" textAlignment="center">
            <Trans i18nKey="st-pod-ready.error.body-with-support">
              Something went wrong while this was starting up. Contact support and we&apos;ll help you get this up and
              running.
            </Trans>
          </Text>
        </Stack>
        <TextLink href={`mailto:${SUPPORT_EMAIL}`} external>
          {SUPPORT_EMAIL}
        </TextLink>
        <Text color="secondary" textAlignment="center" variant="bodySmall">
          {t('st-pod-ready.error.support-ack', "If you've already reached out, we have your request and we're on it.")}
        </Text>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    width: '100%',
    height: '100%',
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
  }),
  card: css({
    maxWidth: 360,
    width: '100%',
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(4),
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(3),
  }),
  icon: css({
    color: theme.colors.error.main,
  }),
});
