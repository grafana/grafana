import React, { useState, useCallback } from 'react';
import { Label, Input, Button } from '@grafana/ui';

// Not public flavors
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
        // alert(`About to merge/update: ${dash.uid} // ${dash.title}`);
        const info = getDashboardSrv().getCurrent()!.updatePanels(dash.panels);
        console.log('INFO', info);
      });
  }, [dashboardId]);

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
    </div>
  );
}
