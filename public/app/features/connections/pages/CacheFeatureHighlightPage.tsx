import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, TextLink, useStyles2 } from '@grafana/ui';
import cacheScreenshot from 'img/cache-screenshot.png';

import { FeatureHighlightsTabPage } from '../components/FeatureHighlightsTabPage';

export function CacheFeatureHighlightPage() {
  const styles = useStyles2(getStyles);

  return (
    <FeatureHighlightsTabPage
      pageName="cache"
      title={t("connections.cache-feature-highlight-page.title", "Get started with Query Caching for data sources")}
      header={t("connections.cache-feature-highlight-page.header", "Query caching can improve load times and reduce API costs by temporarily storing the results of data source queries. When you or other users submit the same query, the results will come back from the cache instead of from the data source.")}
      items={[
        t("connections.cache-feature-highlight-page.item-1", "Faster dashboard load times, especially for popular dashboards."),
        t("connections.cache-feature-highlight-page.item-2", "Reduced API costs."),
        t("connections.cache-feature-highlight-page.item-3", "Reduced likelihood that APIs will rate-limit or throttle requests."),
      ]}
      footer={
        <div>
          <Trans i18nKey="connections.cache-feature-highlight-page.footer">
            Create a Grafana Cloud Free account to start using data source permissions. This feature is also available
            with a Grafana Enterprise license.
          </Trans>
          <div>
            <TextLink href="https://grafana.com/docs/grafana/latest/introduction/grafana-enterprise/">
              <Icon name="external-link-alt" />
              <Trans i18nKey="connections.cache-feature-highlight-page.footer-link">
                Learn about Enterprise
              </Trans>
            </TextLink>
          </div>
        </div>
      }
      linkButtonLabel={t("connections.cache-feature-highlight-page.link-button-label", "Create account")}
      footNote={
        <div className={styles.footNote}>
          <Trans i18nKey="connections.cache-feature-highlight-page.foot-note">
            After creating an account, you can have Grafana{' '}
            <TextLink href="">migrate this instance to Grafana Cloud</TextLink> with minimal effort.
          </Trans>
        </div>
      }
      screenshotPath={cacheScreenshot}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
