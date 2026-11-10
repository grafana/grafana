import { useMemo, useState } from 'react';

import { type PanelNotice } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePanelNotices } from '@grafana/ui/unstable';
import { SandboxConsentModal } from 'app/features/dashboard-scene/scene/sandbox-consent/SandboxConsentModal';
import {
  getBlockedSummary,
  useBlockedSummary,
  type BlockedOriginSummary,
} from 'app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent';

import { type TextSandboxProps } from './TextSandbox';

const NOTICE_ID = 'text-v2-sandbox-consent';
const ACTION_ID = 'review-blocked-content';

interface Props {
  consent: NonNullable<TextSandboxProps['consent']>;
}

/**
 * Publishes a panel warning while the sandbox blocks external content pending
 * viewer consent, with an action that opens the same consent review the
 * dashboard banner offers. This complements the banner (dashboard-wide) with a
 * panel-scoped entry point; both drive the same consent store, so there is one
 * flow, not competing ones. Opening the review never grants consent by itself.
 * No-ops where panel notices are unsupported (e.g. the new panel errors UI
 * flag is off), leaving the banner as the working entry point.
 */
export function TextSandboxConsentNotice({ consent }: Props) {
  const { dashboardUid, panelId } = consent;
  const blocked = useBlockedSummary(dashboardUid, panelId);
  // Snapshot at open, like the banner: a panel reporting mid-review can't join a source the viewer checked.
  const [reviewing, setReviewing] = useState<BlockedOriginSummary[]>();
  const items = useMemo<PanelNotice[]>(() => {
    if (blocked.length === 0) {
      return [];
    }
    return [
      {
        id: NOTICE_ID,
        severity: 'warning',
        text: t('textng.consent-notice.text', '', {
          count: blocked.length,
          host: blocked[0]?.host ?? '',
          defaultValue_one: 'External content from {{host}} is blocked pending viewer approval',
          defaultValue_other: 'External content from {{count}} sources are blocked pending viewer approval',
        }),
        assistant: 'hidden',
        actions: [
          {
            id: ACTION_ID,
            label: t('textng.consent-notice.review', 'Review blocked content'),
            onClick: () => {
              const current = getBlockedSummary(dashboardUid, panelId);
              if (current.length > 0) {
                setReviewing(current);
              }
            },
          },
        ],
      },
    ];
  }, [blocked, dashboardUid, panelId]);
  usePanelNotices(items);
  if (!reviewing) {
    return null;
  }
  return (
    <SandboxConsentModal dashboardUid={dashboardUid} sources={reviewing} onDismiss={() => setReviewing(undefined)} />
  );
}
