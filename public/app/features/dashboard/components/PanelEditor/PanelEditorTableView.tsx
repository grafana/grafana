import { PanelChrome } from '@grafana/ui';
import { PanelRenderer } from 'app/features/panel/PanelRenderer';
import React, { useState } from 'react';
import { PanelModel } from '../../state';
import { usePanelLatestData } from './usePanelLatestData';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';

interface Props {
  width: number;
  height: number;
  panel: PanelModel;
}

export function PanelEditorTableView({ width, height, panel }: Props) {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, true);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });

  if (!data) {
    return null;
  }

  return (
    <PanelChrome width={width} height={height} padding="none">
      {(innerWidth, innerHeight) => (
        <PanelRenderer
          title="Raw data"
          pluginId="table"
          width={innerWidth}
          height={innerHeight}
          data={data}
          options={options}
          onOptionsChange={setOptions}
        />
      )}
    </PanelChrome>
  );
}
