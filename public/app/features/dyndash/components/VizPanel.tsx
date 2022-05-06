import { useObservable } from '@grafana/data';
import { PanelChrome } from '@grafana/ui';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VizPanel } from '../models';

interface Props {
  panel: VizPanel;
}

export const SceneVizView = React.memo<Props>(({ panel }) => {
  const data = useObservable(panel.data, null);
  if (!data) {
    return null;
  }

  return (
    <AutoSizer>
      {({ width, height }) => {
        if (width === null) {
          return null;
        }

        return (
          <PanelChrome width={width} height={height} padding="none">
            {(innerWidth, innerHeight) => (
              <PanelRenderer
                title="Raw data"
                pluginId="timeseries"
                width={innerWidth}
                height={innerHeight}
                data={data}
                options={{}}
                onOptionsChange={() => {}}
              />
            )}
          </PanelChrome>
        );
      }}
    </AutoSizer>
  );
});

SceneVizView.displayName = 'SceneVizView';
