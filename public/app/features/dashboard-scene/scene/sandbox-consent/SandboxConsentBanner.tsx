import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, useStyles2 } from '@grafana/ui';

import { resourcesLabel, SandboxConsentModal } from './SandboxConsentModal';
import { type BlockedOriginSummary, useBlockedSummary } from './sandboxConsent';

interface Props {
  dashboardUid?: string;
  /** Limits the banner to one panel, as in the panel editor. */
  panelId?: number;
  className?: string;
}

export function SandboxConsentBanner({ dashboardUid, panelId, className }: Props) {
  const styles = useStyles2(getStyles);
  const sources = useBlockedSummary(dashboardUid, panelId);
  // Kept as opened, so a panel reporting while the modal is open can't join a source the viewer already checked.
  const [reviewing, setReviewing] = useState<BlockedOriginSummary[]>();

  // A reloading frame clears its report before sending a new one, which mustn't close an open review.
  if (sources.length === 0 && !reviewing) {
    return null;
  }

  const resources = sources.reduce((sum, source) => sum + source.count, 0);
  const title = t('dashboard-scene.sandbox-consent.banner-title', '', {
    count: resources,
    defaultValue_one: '{{resources}} from {{sources}} is blocked',
    defaultValue_other: '{{resources}} from {{sources}} are blocked',
    resources: resourcesLabel(
      resources,
      sources.some((source) => source.truncated)
    ),
    sources: t('dashboard-scene.sandbox-consent.sources', '', {
      count: sources.length,
      defaultValue_one: '{{count}} source',
      defaultValue_other: '{{count}} sources',
    }),
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
              {t('dashboard-scene.sandbox-consent.review', 'Review')}
            </Button>
          }
        >
          {t('dashboard-scene.sandbox-consent.banner-description', 'To load them, review and allow their sources')}
        </Alert>
      )}
      {reviewing && (
        <SandboxConsentModal
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
