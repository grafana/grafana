/* eslint-disable @grafana/i18n/no-untranslated-strings */
import insightsScreenshot from 'img/insights-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage';

export function InsightsFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
      pageName="insights"
      title="Get started with data source usage insights in Grafana Enterprise"
      header="Usage Insights provide detailed information about data source usage, like the number of views, queries, and errors users have experienced. You can use this to improve users’ experience and troubleshoot issues."
      items={[
        'Demonstrate and improve the value of your observability service by keeping track of user engagement',
        'Keep Grafana performant and by identifying and fixing slow, error-prone data sources',
        'Clean up your instance by finding and removing unused data sources',
        'Review individual data source usage insights at a glance in the UI, sort search results by usage and errors, or dig into detailed usage logs',
      ]}
      footer={
        <div>
          Grafana Enterprise offers you not only usage insights but many more advanced features like Enterprise plugins,
          dashboard search and reporting.
        </div>
      }
      linkButtonLabel="Learn about Grafana Enterprise"
      screenshotPath={insightsScreenshot}
    />
  );
}
