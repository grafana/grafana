import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

export function getCanInviteUsersToOrg(): boolean {
  const canAddToOrg: boolean = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

  // Show invite button in the following cases:
  // 1) the instance is not a hosted Grafana instance (!config.externalUserMngInfo)
  // 2) new basic auth users can be created for this instance (!config.disableLoginForm).
  return canAddToOrg && !(config.disableLoginForm && config.externalUserMngInfo);
}

export function getExternalUserMngLinkUrl(cnt: string) {
  const url = new URL(config.externalUserMngLinkUrl);

  if (config.externalUserMngAnalytics) {
    // Add query parameters in config.externalUserMngAnalyticsParams to track conversion
    if (!!config.externalUserMngAnalyticsParams) {
      const params = config.externalUserMngAnalyticsParams.split('&');
      params.forEach((param) => {
        const [key, value] = param.split('=');
        url.searchParams.append(key, value);
      });
    }

    // Add specific CTA cnt to track conversion
    url.searchParams.append('cnt', cnt);
  }

  return url.toString();
}
