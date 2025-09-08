/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, TextLink, useStyles2 } from "@grafana/ui";
import cacheScreenshot from 'img/cache-screenshot.png';

import { FeatureHighlightsTabPage } from "../components/FeatureHighlightsTabPage";

export function CacheFeatureHighlightPage() {
  const styles = useStyles2(getStyles);

  return (
    <FeatureHighlightsTabPage
    pageName="cache"
    title="Get started with Query Caching for data sources"
    header="Query caching can improve load times and reduce API costs by temporarily storing the results of data source queries. When you or other users submit the same query, the results will come back from the cache instead of from the data source."
    items={[
      "Faster dashboard load times, especially for popular dashboards.",
      "Reduced API costs.",
      "Reduced likelihood that APIs will rate-limit or throttle requests.",
    ]}
      footer={<div>
        Create a Grafana Cloud Free account to start using data source permissions.
        This feature is also available with a Grafana Enterprise license.
        <div>
          <TextLink href="https://grafana.com/docs/grafana/latest/introduction/grafana-enterprise/">
            <Icon name="external-link-alt" />
            Learn about Enterprise
          </TextLink>
        </div>
      </div>}
    linkButtonLabel="Create account"
      footNote={<div className={styles.footNote}>
        After creating an account, you can have Grafana <TextLink href="">migrate this instance to Grafana Cloud</TextLink> with minimal effort.
      </div>}
    screenshotPath={cacheScreenshot} />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
