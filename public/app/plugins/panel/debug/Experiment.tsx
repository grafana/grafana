import React, { useState, useCallback } from 'react';
import { Label, Input, Button } from '@grafana/ui';
import { PanelModel } from '@grafana/data';

// Not from the public API (but same objects)
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

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
        const info = getDashboardSrv().getCurrent()!.updatePanels(dash.panels);
        console.log('LOAD', info);
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
    console.log('appendPanel', info);
  }, []);

  const setWidths = useCallback(() => {
    const dash = getDashboardSrv().getCurrent()!;
    const newPanels = dash.panels.map((p) => {
      const s = p.getSaveModel();
      if (s.gridPos.w === 24) {
        s.gridPos.w = 3 + Math.floor(Math.random() * 20);
      } else {
        s.gridPos.w = 24; // full width;
      }
      return s;
    });
    const info = dash.updatePanels(newPanels);
    console.log('setWidths', info);
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
