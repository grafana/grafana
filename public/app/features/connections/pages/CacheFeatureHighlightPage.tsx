import { t } from '@grafana/i18n';
import cacheScreenshot from 'img/cache-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage/FeatureHighlightsTabPage';
import { Footer } from '../components/FeatureHighlightsTabPage/Footer';
import { Footnote } from '../components/FeatureHighlightsTabPage/Footnote';

export function CacheFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
      pageName="cache"
      title={t('connections.cache-feature-highlight-page.title', 'Get started with Query Caching for data sources')}
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
      footer={<Footer />}
      linkButtonLabel={t('connections.cache-feature-highlight-page.link-button-label', 'Create account')}
      buttonLink={'https://grafana.com/auth/sign-up/create-user'}
      footNote={<Footnote />}
      screenshotPath={cacheScreenshot}
    />
  );
}
