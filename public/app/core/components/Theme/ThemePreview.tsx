import { css, cx } from '@emotion/css';

import { GrafanaTheme2, ThemeContext } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Divider, Icon, Stack, useStyles2 } from '@grafana/ui';

import { Branding } from '../Branding/Branding';

interface ThemePreviewProps {
  theme: GrafanaTheme2;
}

export function ThemePreview({ theme }: ThemePreviewProps) {
  return (
    <ThemeContext.Provider value={theme}>
      <ThemePreviewWithContext />
    </ThemeContext.Provider>
  );
}

function ThemePreviewWithContext() {
  const styles = useStyles2(getStyles);

  return (
    <Box backgroundColor={'canvas'} display={'flex'} direction={'column'} grow={1}>
      <Stack gap={0} direction="column">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap={0.5}
          backgroundColor="primary"
          height={3}
          paddingY={0.5}
          paddingX={1}
        >
          <Stack alignItems="center" gap={0.5}>
            <Branding.MenuLogo className={styles.img} />
            <div className={styles.breadcrumbs}>
              <Trans i18nKey="theme-preview.breadcrumbs.home">Home</Trans>
              <Icon className={styles.breadcrumbSeparator} name="angle-right" />
              <Trans i18nKey="theme-preview.breadcrumbs.dashboards">Dashboards</Trans>
            </div>
          </Stack>
          <Stack alignItems="center" gap={0.5}>
            <div className={styles.formInput} />
            <Box
              borderStyle="solid"
              borderColor="medium"
              borderRadius="circle"
              height={1}
              width={1}
              backgroundColor="secondary"
              marginLeft={0.5}
            />
          </Stack>
        </Box>
        <Divider spacing={0} />
        <Box padding={2.5} display="flex" direction="column" flex={1}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <Trans i18nKey="theme-preview.panel.title">Panel</Trans>
            </div>
            <Box padding={0.5} display="flex" direction="column" gap={0.5} grow={1}>
              <div className={styles.formLabel}>
                <Trans i18nKey="theme-preview.panel.form-label">Form label</Trans>
              </div>
              <div className={styles.formInput} />
            </Box>
            <Box display="flex" gap={0.5} padding={1} justifyContent="flex-end">
              <div className={cx(styles.action, styles.actionSecondary)} />
              <div className={cx(styles.action, styles.actionDanger)} />
              <div className={cx(styles.action, styles.actionPrimary)} />
            </Box>
          </div>
        </Box>
      </Stack>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumbs: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      fontSize: Math.round(theme.typography.fontSize / 3),
      gap: theme.spacing(0.25),
      lineHeight: Math.round(theme.typography.body.lineHeight / 3),
      paddingLeft: theme.spacing(0.5),
    }),
    breadcrumbSeparator: css({
      height: theme.spacing(0.75),
      width: theme.spacing(0.75),
    }),
    img: css({
      height: theme.spacing(1),
      width: theme.spacing(1),
    }),
    panel: css({
      background: theme.components.panel.background,
      border: `1px solid ${theme.components.panel.borderColor}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    panelHeader: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      fontSize: Math.round(theme.typography.fontSize / 3),
      height: theme.spacing(2),
      lineHeight: Math.round(theme.typography.body.lineHeight / 3),
      padding: theme.spacing(0.5),
    }),
    formLabel: css({
      color: theme.colors.text.primary,
      fontSize: Math.round(theme.typography.fontSize / 3),
      lineHeight: Math.round(theme.typography.body.lineHeight / 3),
    }),
    formInput: css({
      background: theme.components.input.background,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      height: theme.spacing(1),
      width: theme.spacing(6),
    }),
    action: css({
      borderRadius: theme.shape.radius.default,
      height: theme.spacing(1),
      width: theme.spacing(2.5),
    }),
    actionSecondary: css({
      background: theme.colors.secondary.main,
    }),
    actionDanger: css({
      background: theme.colors.error.main,
    }),
    actionPrimary: css({
      background: theme.colors.primary.main,
    }),
  };
};
