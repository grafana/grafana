import { t, Trans } from '@grafana/i18n';
import insightsScreenshot from 'img/insights-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage/FeatureHighlightsTabPage';

export function InsightsFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
      pageName="insights"
      title={t(
        'connections.insights-feature-highlight-page.title',
        'Get started with data source usage insights in Grafana Enterprise'
      )}
      header={t(
        'connections.insights-feature-highlight-page.header',
        'Usage Insights provide detailed information about data source usage, like the number of views, queries, and errors users have experienced. You can use this to improve users’ experience and troubleshoot issues.'
      )}
      items={[
        t(
          'connections.insights-feature-highlight-page.item-1',
          'Demonstrate and improve the value of your observability service by keeping track of user engagement'
        ),
        t(
          'connections.insights-feature-highlight-page.item-2',
          'Keep Grafana performant and by identifying and fixing slow, error-prone data sources'
        ),
        t(
          'connections.insights-feature-highlight-page.item-3',
          'Clean up your instance by finding and removing unused data sources'
        ),
        t(
          'connections.insights-feature-highlight-page.item-4',
          'Review individual data source usage insights at a glance in the UI, sort search results by usage and errors, or dig into detailed usage logs'
        ),
      ]}
      footer={
        <div>
          <Trans i18nKey="connections.insights-feature-highlight-page.footer">
            Grafana Enterprise offers you not only usage insights but many more advanced features like Enterprise
            plugins, dashboard search and reporting.
          </Trans>
        </div>
      }
      linkButtonLabel={t(
        'connections.insights-feature-highlight-page.link-button-label',
        'Learn about Grafana Enterprise'
      )}
      buttonLink={'https://grafana.com/products/enterprise/grafana/'}
      screenshotPath={insightsScreenshot}
    />
  );
}
