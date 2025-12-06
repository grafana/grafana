import { ExploreMapDrilldownPanel } from './ExploreMapDrilldownPanel';

interface ExploreMapLogsDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
}

export function ExploreMapLogsDrilldownPanel({ exploreId, width, height }: ExploreMapLogsDrilldownPanelProps) {
  return (
    <ExploreMapDrilldownPanel
      exploreId={exploreId}
      width={width}
      height={height}
      mode="logs-drilldown"
      appPath="/a/grafana-lokiexplore-app"
      titleKey="explore-map.panel.logs-drilldown"
      titleDefault="Logs Drilldown"
    />
  );
}

