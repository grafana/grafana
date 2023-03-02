import React, { useEffect, useState } from 'react';

import { PanelData } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { PanelChrome, PopoverContent } from '@grafana/ui';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import { PanelOptions } from 'app/plugins/panel/table/panelcfg.gen';

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

export function panelError(data: PanelData) {
  let errorMessage: PopoverContent | undefined = undefined;
  const { error, errors } = data;
  if (errors?.length) {
    if (errors.length > 1) {
      errorMessage = (
        <>
          <b>Multiple errors found:</b>
          {errors.map((e, i) => (
            <li key={`query-error-${i}`}>{e.message}</li>
          ))}
        </>
      );
    } else {
      errorMessage = errors[0].message;
    }
  } else if (error) {
    errorMessage = error.message;
  }
  return errorMessage;
}

export function PanelEditorTableView({ width, height, panel, dashboard }: Props) {
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, false);
  const [options, setOptions] = useState<PanelOptions>({
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
        dashboardId: dashboard.id,
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
  return (
    <PanelChrome width={width} height={height} padding="none">
      {(innerWidth, innerHeight) => (
        <>
          <PanelHeaderCorner panel={panel} error={panelError(data)} />
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
