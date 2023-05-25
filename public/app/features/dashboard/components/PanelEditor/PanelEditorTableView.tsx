import React, { useEffect, useState } from 'react';

import { RefreshEvent } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import { Options } from 'app/plugins/panel/table/panelcfg.gen';

import PanelHeaderCorner from '../../dashgrid/PanelHeader/PanelHeaderCorner';
import { getTimeSrv } from '../../services/TimeSrv';
import { DashboardModel, PanelModel } from '../../state';

import { usePanelLatestData } from './usePanelLatestData';

export interface Props {
  width: number;
  height: number;
  panel: PanelModel;
  dashboard: DashboardModel;
}

export function PanelEditorTableView({ width, height, panel, dashboard }: Props) {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, false);
  const [options, setOptions] = useState<Options>({
    frameIndex: 0,
    showHeader: true,
    showTypeIcons: true,
  });

  // Subscribe to panel event
  useEffect(() => {
    const timeSrv = getTimeSrv();

    const sub = panel.events.subscribe(RefreshEvent, () => {
      const timeData = applyPanelTimeOverrides(panel, timeSrv.timeRange());
      panel.runAllPanelQueries({
        dashboardUID: dashboard.uid,
        dashboardTimezone: dashboard.getTimezone(),
        timeData,
        width,
      });
    });
    return () => {
      sub.unsubscribe();
    };
  }, [panel, dashboard, width]);

  if (!data) {
    return null;
  }

  const errorMessage = data?.errors
    ? data.errors.length > 1
      ? 'Multiple errors found. Click for more details'
      : data.errors[0].message
    : data?.error?.message;
  return (
    <PanelChrome width={width} height={height} padding="none">
      {(innerWidth, innerHeight) => (
        <>
          <PanelHeaderCorner panel={panel} error={errorMessage} />
          <PanelRenderer
            title="Raw data"
            pluginId="table"
            width={innerWidth}
            height={innerHeight}
            data={data}
            options={options}
            onOptionsChange={setOptions}
          />
        </>
      )}
    </PanelChrome>
  );
}
