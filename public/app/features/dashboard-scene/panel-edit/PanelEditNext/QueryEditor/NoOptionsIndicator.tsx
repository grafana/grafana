import { css } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

interface NoOptionsIndicatorProps {
  name: string;
}

export function NoOptionsIndicator({ name }: NoOptionsIndicatorProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Icon name="check-circle" size="lg" className={styles.icon} />
      <Stack direction="column" gap={0.25}>
        <span className={styles.title}>{t('transformation-editor.no-options.title', 'No options to configure')}</span>
        <span className={styles.description}>
          {t(
            'transformation-editor.no-options.description',
            '{{name}} will be applied automatically to your data unless the transformation is disabled.',
            {
              name,
              interpolation: { escapeValue: false },
            }
          )}
        </span>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    borderLeft: `3px solid ${theme.colors.success.main}`,
    background: colorManipulator.alpha(theme.colors.success.main, 0.07),
  }),
  icon: css({
    color: theme.colors.success.text,
    flexShrink: 0,
  }),
  title: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  description: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
});
