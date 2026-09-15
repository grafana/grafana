import { css } from '@emotion/css';

import { type GrafanaTheme2, type LinkModel, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';

type Props = {
  focusSpanLink: LinkModel;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    shareButton: css({
      [theme.breakpoints.down('sm')]: {
        span: {
          display: 'none',
        },
      },
    }),
  };
}

function getShareUrl(href: string | undefined): string {
  const current = window.location.href;
  if (!href) {
    return current;
  }
  try {
    const sanitized = textUtil.sanitizeUrl(new URL(href, current).href);
    if (!sanitized || sanitized === 'about:blank') {
      return current;
    }
    return sanitized;
  } catch {
    return current;
  }
}

export function ShareSpanButton({ focusSpanLink }: Props) {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();

  return (
    <Button
      data-testid="share-span-button"
      variant="secondary"
      size="sm"
      icon="share-alt"
      fill="outline"
      className={styles.shareButton}
      onClick={() => {
        copyStringToClipboard(getShareUrl(focusSpanLink?.href));
        notifyApp.success(t('explore.span-detail.link-copied', 'Link copied to clipboard'));
      }}
    >
      <Trans i18nKey="explore.span-detail.share-span">Share</Trans>
    </Button>
  );
}
