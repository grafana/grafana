import { ExploreMapDrilldownPanel } from './ExploreMapDrilldownPanel';

interface ExploreMapMetricsDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
}

export function ExploreMapMetricsDrilldownPanel({ exploreId, width, height }: ExploreMapMetricsDrilldownPanelProps) {
  return (
    <ExploreMapDrilldownPanel
      exploreId={exploreId}
      width={width}
      height={height}
      mode="metrics-drilldown"
      appPath="/a/grafana-metricsdrilldown-app"
      titleKey="explore-map.panel.metrics-drilldown"
      titleDefault="Metrics Drilldown"
    />
  );
}

