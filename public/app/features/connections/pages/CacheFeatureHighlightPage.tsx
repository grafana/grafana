/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { FeatureHighlightsTabPage } from "../components/FeatureHighlightsTabPage";

export function CacheFeatureHighlightPage() {
  return (
    <FeatureHighlightsTabPage
    pageName="cache"
    title="Get started with caching in Grafana Cloud"
    header="Caching in Grafana Cloud helps you improve the performance of your Grafana instance by reducing the amount of data that needs to be processed."
    footer={<div>Insights</div>}
    items={[
      "Cache",
      "Cache",
      "Insights",
    ]}
    linkButtonLabel="Cache"
    footNote={<div>Cache</div>}
    screenshotPath="Cache" />
  );
}
