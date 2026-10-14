import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, useStyles2 } from '@grafana/ui';

import { imagesLabel, TextSandboxConsentModal } from './TextSandboxConsentModal';
import { type BlockedOriginSummary, useBlockedSummary } from './textSandboxConsent';

interface Props {
  dashboardUid?: string;
  /** Limits the banner to one panel, as in the panel editor. */
  panelId?: number;
  className?: string;
}

export function TextSandboxConsentBanner({ dashboardUid, panelId, className }: Props) {
  const styles = useStyles2(getStyles);
  const sources = useBlockedSummary(dashboardUid, panelId);
  // Kept as opened, so a panel reporting while the modal is open can't join a source the viewer already checked.
  const [reviewing, setReviewing] = useState<BlockedOriginSummary[]>();

  // A reloading frame clears its report before sending a new one, which mustn't close an open review.
  if (sources.length === 0 && !reviewing) {
    return null;
  }

  const images = sources.reduce((sum, source) => sum + source.count, 0);
  const title = t('dashboard-scene.text-sandbox-consent.banner-title', '', {
    count: sources.length,
    defaultValue_one: '{{resources}} with {{images}} is being blocked',
    defaultValue_other: '{{resources}} with {{images}} are being blocked',
    resources: t('dashboard-scene.text-sandbox-consent.resources', '', {
      count: sources.length,
      defaultValue_one: '{{count}} resource',
      defaultValue_other: '{{count}} resources',
    }),
    images: imagesLabel(
      images,
      sources.some((source) => source.truncated)
    ),
  });

  return (
    <>
      {sources.length > 0 && (
        <Alert
          severity="warning"
          title={title}
          className={cx(styles.banner, className)}
          topSpacing={0}
          bottomSpacing={0}
          action={
            <Button variant="secondary" fill="outline" size="sm" onClick={() => setReviewing(sources)}>
              {t('dashboard-scene.text-sandbox-consent.review', 'Review')}
            </Button>
          }
        >
          {t(
            'dashboard-scene.text-sandbox-consent.banner-description',
            'To see these images, please review and allow their sources'
          )}
        </Alert>
      )}
      {reviewing && (
        <TextSandboxConsentModal
          dashboardUid={dashboardUid}
          sources={reviewing}
          onDismiss={() => setReviewing(undefined)}
        />
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Alert grows by default, which would stretch it inside the page's flex column.
  banner: css({
    flexGrow: 0,
    margin: theme.spacing(1, 2, 0),
  }),
});
