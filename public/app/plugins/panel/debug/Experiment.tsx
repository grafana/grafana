import React, { useState, useCallback } from 'react';
import { Label, Input, Button } from '@grafana/ui';

// Not public flavors
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from '../../../../../packages/grafana-data/src';

export function ExperimentalPanel() {
  const [dashboardId, setDashboardId] = useState<string>();
  const loadDashboard = useCallback(() => {
    if (!dashboardId) {
      return;
    }
    getBackendSrv()
      .getDashboardByUid(dashboardId!)
      .then((data) => {
        const dash = data.dashboard;
        console.log('About to merge/update', dash);
        // alert(`About to merge/update: ${dash.uid} // ${dash.title}`);
        const info = getDashboardSrv().getCurrent()!.updatePanels(dash.panels);
        console.log('INFO', info);
      });
  }, [dashboardId]);

  const appendPanel = useCallback(() => {
    const dash = getDashboardSrv().getCurrent()!;
    const newPanels = [
      ...dash.panels,
      ({
        title: 'generated panel',
        type: 'timeseries',
        gridPos: { w: 3 + Math.floor(Math.random() * 10) },
      } as unknown) as PanelModel,
    ];
    const info = dash.updatePanels(newPanels);
    console.log('INFO', info);
  }, []);

  const setWidths = useCallback(() => {
    const dash = getDashboardSrv().getCurrent()!;
    const newPanels = dash.panels.map((p) => {
      const s = p.getSaveModel();
      s.gridPos.w = 24; // full width;
      return s;
    });
    const info = dash.updatePanels(newPanels);
    console.log('INFO', info);
  }, []);

  return (
    <div>
      <Label>Dashboard</Label>
      <Input
        value={dashboardId}
        onChange={(e) => setDashboardId(e.currentTarget.value)}
        placeholder="enter dashbaord id"
      />
      <Button variant={dashboardId ? 'primary' : 'secondary'} onClick={loadDashboard}>
        Merge
      </Button>

      <br />
      <br />

      <Button size="sm" variant={'primary'} onClick={appendPanel}>
        Append panel
      </Button>
      <Button size="sm" variant={'primary'} onClick={setWidths}>
        Set widths
      </Button>
    </div>
  );
}
