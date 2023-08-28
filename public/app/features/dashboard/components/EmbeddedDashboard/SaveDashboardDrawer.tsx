import React, { useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';

import { DashboardModel } from '../../state';
import DashboardValidation from '../SaveDashboard/DashboardValidation';
import { SaveDashboardDiff } from '../SaveDashboard/SaveDashboardDiff';
import { SaveDashboardData } from '../SaveDashboard/types';
import { jsonDiff } from '../VersionHistory/utils';

import { SaveDashboardForm } from './SaveDashboardForm';

type SaveDashboardDrawerProps = {
  dashboard: DashboardModel;
  onDismiss: () => void;
  dashboardJson: string;
  onSave: (clone: DashboardModel) => Promise<unknown>;
};

export const SaveDashboardDrawer = ({ dashboard, onDismiss, dashboardJson, onSave }: SaveDashboardDrawerProps) => {
  const data = useMemo<SaveDashboardData>(() => {
    const clone = dashboard.getSaveModelClone();
    const cloneJSON = JSON.stringify(clone, null, 2);
    const cloneSafe = JSON.parse(cloneJSON); // avoids undefined issues

    const diff = jsonDiff(JSON.parse(JSON.stringify(dashboardJson, null, 2)), cloneSafe);
    let diffCount = 0;
    for (const d of Object.values(diff)) {
      diffCount += d.length;
    }

    return {
      clone,
      diff,
      diffCount,
      hasChanges: diffCount > 0,
    };
  }, [dashboard, dashboardJson]);

  const [showDiff, setShowDiff] = useState(false);

  return (
    <Drawer
      title={'Save dashboard'}
      onClose={onDismiss}
      subtitle={dashboard.title}
      tabs={
        <TabsBar>
          <Tab label={'Details'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
          {data.hasChanges && (
            <Tab label={'Changes'} active={showDiff} onChangeTab={() => setShowDiff(true)} counter={data.diffCount} />
          )}
        </TabsBar>
      }
      scrollableContent
    >
      {showDiff ? (
        <SaveDashboardDiff diff={data.diff} oldValue={dashboardJson} newValue={data.clone} />
      ) : (
        <SaveDashboardForm
          dashboard={dashboard}
          saveModel={data}
          onCancel={onDismiss}
          onSuccess={onDismiss}
          onSubmit={onSave}
        />
      )}

      {config.featureToggles.showDashboardValidationWarnings && <DashboardValidation dashboard={dashboard} />}
    </Drawer>
  );
};
