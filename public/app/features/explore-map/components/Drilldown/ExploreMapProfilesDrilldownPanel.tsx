import { ExploreMapDrilldownPanel } from './ExploreMapDrilldownPanel';

interface ExploreMapProfilesDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
}

export function ExploreMapProfilesDrilldownPanel({ exploreId, width, height }: ExploreMapProfilesDrilldownPanelProps) {
  return (
    <ExploreMapDrilldownPanel
      exploreId={exploreId}
      width={width}
      height={height}
      mode="profiles-drilldown"
      appPath="/a/grafana-pyroscope-app"
      titleKey="explore-map.panel.profiles-drilldown"
      titleDefault="Profiles Drilldown"
    />
  );
}

