import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

interface PreviewOverlayProps {
  onApply?: () => void;
}

export function PreviewOverlay({ onApply }: PreviewOverlayProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.previewBadge}>
      <span className={styles.previewLabel}>{t('dashboard-scene.panel-editor.preview-label', 'Preview')}</span>
      {onApply && (
        <Button size="sm" onClick={onApply} className={styles.previewButton}>
          <Trans i18nKey="dashboard-scene.panel-editor.use-suggestion">Use this suggestion</Trans>
        </Button>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    previewBadge: css({
      position: 'absolute',
      top: -1,
      left: -1,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      backgroundColor: theme.colors.primary.border,
      color: theme.colors.primary.contrastText,
      padding: theme.spacing(0.5, 1),
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      zIndex: 1,
    }),
    previewLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    previewButton: css({
      height: 'auto',
      padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1.2,
    }),
  };
}
