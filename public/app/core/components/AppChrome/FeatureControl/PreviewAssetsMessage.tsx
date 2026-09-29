/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { Button, ClipboardButton, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

interface PreviewAssetsMessageProps {
  previewAssetsFolder: string;
}

export const PreviewAssetsMessage = ({ previewAssetsFolder }: PreviewAssetsMessageProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.previewStatus} role="status">
      <Icon name="info-circle" className={styles.previewIcon} />
      <div className={styles.previewText}>
        <Text variant="bodySmall" weight="medium">
          Frontend preview active
        </Text>
        <Text variant="bodySmall" color="secondary">
          Build <span className={styles.code}>{previewAssetsFolder}</span> live for just you.
        </Text>
      </div>

      <Stack direction="column" gap={1} alignItems="flex-end">
        <Button
          size="sm"
          variant="secondary"
          // Must be a full page load so the request reaches the frontend service instead of the SPA router
          onClick={() => window.location.assign('/-/set-preview-assets?clear=1')}
        >
          Stop preview
        </Button>
        <ClipboardButton
          size="sm"
          variant="secondary"
          getText={() => {
            const url = new URL('/-/set-preview-assets', window.location.origin);
            url.searchParams.set('assets', previewAssetsFolder);
            return url.href;
          }}
        >
          Copy share link
        </ClipboardButton>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    previewStatus: css({
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr) auto',
      gap: theme.spacing(1),
      alignItems: 'center',
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderLeft: `3px solid ${theme.colors.info.border}`,
      borderRadius: theme.shape.radius.default,
    }),
    previewIcon: css({
      color: theme.colors.info.text,
    }),
    previewText: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }),
    code: css({
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
  };
};
