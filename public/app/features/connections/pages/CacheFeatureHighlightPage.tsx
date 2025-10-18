import { t } from '@grafana/i18n';

import cacheScreenshot from 'img/cache-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage';

export function CacheFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
      pageName="cache"
      title={t(
        'connections.cache-feature-highlight-page.title',
        'Optimize queries with Query Caching in Grafana Cloud'
      )}
      header={t(
        'connections.cache-feature-highlight-page.header',
        'Query caching can improve load times and reduce API costs by temporarily storing the results of data source queries. When you or other users submit the same query, the results will come back from the cache instead of from the data source.'
      )}
      items={[
        t(
          'connections.cache-feature-highlight-page.item-1',
          'Faster dashboard load times, especially for popular dashboards.'
        ),
        t('connections.cache-feature-highlight-page.item-2', 'Reduced API costs.'),
        t(
          'connections.cache-feature-highlight-page.item-3',
          'Reduced likelihood that APIs will rate-limit or throttle requests.'
        ),
      ]}
      buttonLink={'https://grafana.com/auth/sign-up/create-user?src=oss-grafana&cnt=datasource-caching'}
      screenshotPath={cacheScreenshot}
    />
  );
}
