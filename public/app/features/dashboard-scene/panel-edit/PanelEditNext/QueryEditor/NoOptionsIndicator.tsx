import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

import { QueryEditorType } from '../constants';

import { useQueryEditorTypeConfig } from './QueryEditorContext';

interface NoOptionsIndicatorProps {
  name: string;
}

export function NoOptionsIndicator({ name }: NoOptionsIndicatorProps) {
  const typeConfig = useQueryEditorTypeConfig();
  const transformationColor = typeConfig[QueryEditorType.Transformation].color;
  const styles = useStyles2(getStyles, transformationColor);
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

const getStyles = (theme: GrafanaTheme2, transformationColor: string) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    position: 'relative',
    background: `color-mix(in srgb, ${transformationColor} 10%, ${theme.colors.background.secondary} 100%)`,

    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: transformationColor,
    },
  }),
  icon: css({
    color: transformationColor,
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
