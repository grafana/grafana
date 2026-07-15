import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getCanInviteUsersToOrg, getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

import type { RecommendationItem } from './Recommendations';

// Minimal slice of the /api/org/users/search payload; the full result also carries orgUsers/paging.
interface OrgUsersSearchResult {
  totalCount?: number;
}

/**
 * Number of (non-hidden) users in the current org, or null when the requester lacks
 * org.users:read or the lookup fails — callers fall back to copy without numbers. Never rejects.
 */
export async function fetchOrgUserCount(): Promise<number | null> {
  if (!contextSrv.hasPermission(AccessControlAction.OrgUsersRead)) {
    return null;
  }
  try {
    const result = await getBackendSrv().get<OrgUsersSearchResult>('/api/org/users/search', { perpage: 1, page: 1 });
    return typeof result.totalCount === 'number' ? result.totalCount : null;
  } catch {
    return null;
  }
}

// Where "Invite teammates" sends the user: the external user-management portal when one is
// configured (hosted Grafana), otherwise the built-in invite page. Null when the user cannot
// add org users or no invite path exists.
function getInviteTeamHref(): string | null {
  if (config.externalUserMngLinkUrl) {
    if (!contextSrv.hasPermission(AccessControlAction.OrgUsersAdd)) {
      return null;
    }
    try {
      return getExternalUserMngLinkUrl('home-recommendations');
    } catch {
      return null; // malformed config.externalUserMngLinkUrl must not take down the homepage
    }
  }
  return getCanInviteUsersToOrg() ? locationUtil.assureBaseUrl('/org/users/invite') : null;
}

/**
 * The always-appended last recommendation: bring teammates in. It doubles as the fallback that
 * keeps the section rendered when every curated app is enabled. Null when the user cannot invite.
 * The context line only states a user count that was actually resolved — never a static claim.
 */
export function buildInviteTeamItem(userCount: number | null): RecommendationItem | null {
  const href = getInviteTeamHref();
  if (!href) {
    return null;
  }
  return {
    id: 'invite-team',
    icon: 'users-alt',
    color: (theme) => theme.visualization.getColorByName('yellow'),
    title: t('home.recommendations.invite-team.title', 'Invite your team'),
    context:
      userCount !== null && userCount >= 1
        ? t('home.recommendations.invite-team.user-count', '', {
            count: userCount,
            defaultValue_one: "You're the only user here",
            defaultValue_other: '{{count}} users in this organization',
          })
        : t('home.recommendations.invite-team.context', 'Bring your teammates into Grafana'),
    description: t(
      'home.recommendations.invite-team.description',
      'Observability is a team sport — share dashboards, alerts, and on-call with your teammates.'
    ),
    action: t('home.recommendations.invite-team.action', 'Invite teammates'),
    href,
  };
}
