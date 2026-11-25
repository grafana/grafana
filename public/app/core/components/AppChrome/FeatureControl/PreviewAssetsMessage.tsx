/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { Button, ClipboardButton, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

const FRONTEND_PREVIEW_PRS_URL =
  'https://github.com/grafana/grafana/pulls?q=is%3Apr+is%3Aopen+label%3Adeploy-frontend-preview+sort%3Aupdated-desc';

// Preview deploy folders look like `pr_grafana_123456` (pr_<repo>_<number>).
const previewFolderPattern = /^pr_([a-zA-Z0-9]+)_(\d+)$/;

const getPullRequestUrl = (previewAssetsFolder: string): string | undefined => {
  const match = previewFolderPattern.exec(previewAssetsFolder);
  if (!match) {
    return undefined;
  }

  const [, repo, prNumber] = match;
  return `https://github.com/grafana/${repo}/pull/${prNumber}`;
};

interface PreviewAssetsMessageProps {
  previewAssetsFolder: string;
}

export const PreviewAssetsMessage = ({ previewAssetsFolder }: PreviewAssetsMessageProps) => {
  const styles = useStyles2(getStyles);
  const pullRequestUrl = getPullRequestUrl(previewAssetsFolder);

  return (
    <div className={styles.previewStatus} role="status">
      <div className={styles.previewHeader}>
        <Icon name="info-circle" className={styles.previewIcon} />
        <div className={styles.previewText}>
          <Text variant="bodySmall" weight="medium">
            Frontend preview active
          </Text>
          <Text variant="bodySmall" color="secondary">
            Build <span className={styles.code}>{previewAssetsFolder}</span> live for just you.
          </Text>
        </div>
      </div>

      <Stack direction="row" gap={1} wrap="wrap">
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
        {pullRequestUrl && (
          <LinkButton
            size="sm"
            variant="secondary"
            icon="external-link-alt"
            href={pullRequestUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open PR
          </LinkButton>
        )}
        <LinkButton
          size="sm"
          variant="secondary"
          icon="list-ul"
          href={FRONTEND_PREVIEW_PRS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          All open frontend preview PRs
        </LinkButton>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    previewStatus: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderLeft: `3px solid ${theme.colors.info.border}`,
      borderRadius: theme.shape.radius.default,
    }),
    previewHeader: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      alignItems: 'center',
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
