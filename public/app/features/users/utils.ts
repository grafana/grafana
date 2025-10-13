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
