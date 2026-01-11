import { config } from '@grafana/runtime';

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

export function getUpgradeUrl(cnt?: string) {
  const orgName = config.bootData?.user?.orgName;

  let baseUrl: string;
  if (orgName) {
    // Use org-specific URL: https://grafana.com/orgs/<org-name>/my-account/manage-plan
    baseUrl = `https://grafana.com/orgs/${encodeURIComponent(orgName)}/my-account/manage-plan`;
  } else {
    // Fallback to generic subscription page
    baseUrl = 'https://grafana.com/profile/org/subscription';
  }

  // Add cnt parameter for conversion tracking if provided
  if (cnt) {
    const url = new URL(baseUrl);
    url.searchParams.append('cnt', cnt);
    return url.toString();
  }

  return baseUrl;
}
