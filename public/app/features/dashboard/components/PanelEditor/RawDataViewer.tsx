import { PanelChrome } from '@grafana/ui';
import { PanelRenderer } from 'app/features/panel/PanelRenderer';
import React from 'react';
import { PanelModel } from '../../state';
import { usePanelLatestData } from './usePanelLatestData';

interface Props {
  width: number;
  height: number;
  panel: PanelModel;
}

export function RawDataViewer({ width, height, panel }: Props) {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, true);

  if (!data) {
    return null;
  }

  return (
    <PanelChrome width={width} height={height} padding="none">
      {(innerWidth, innerHeight) => (
        <PanelRenderer title="Raw data" pluginId="table" width={innerWidth} height={innerHeight} data={data} />
      )}
    </PanelChrome>
  );
}
