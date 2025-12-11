import { ExploreMapDrilldownPanel } from './ExploreMapDrilldownPanel';

interface ExploreMapTracesDrilldownPanelProps {
  exploreId: string;
  width: number;
  height: number;
}

export function ExploreMapTracesDrilldownPanel({ exploreId, width, height }: ExploreMapTracesDrilldownPanelProps) {
  return (
    <ExploreMapDrilldownPanel
      exploreId={exploreId}
      width={width}
      height={height}
      mode="traces-drilldown"
      appPath="/a/grafana-exploretraces-app"
      titleKey="explore-map.panel.traces-drilldown"
      titleDefault="Traces Drilldown"
    />
  );
}

