import React from 'react';
import angular from 'angular';
import AutoSizer from 'react-virtualized-auto-sizer';
import { CodeEditor } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import './SettingsCtrl';

interface Props {
  dashboard: DashboardModel;
}

export const JsonEditorSettings: React.FC<Props> = ({ dashboard }) => {
  const height = 500;
  const dashboardJson = angular.toJson(dashboard.getSaveModelClone(), true);
  return (
    <>
      <h3 className="dashboard-settings__header">JSON Model</h3>
      <div className="dashboard-settings__subheader">
        The JSON Model below is data structure that defines the dashboard. Including settings, panel settings & layout,
        queries etc.
      </div>

      <div className="gf-form">
        <AutoSizer disableHeight>
          {({ width }) => (
            <CodeEditor value={dashboardJson} language="json" width={width} height={height} showMiniMap={false} />
          )}
        </AutoSizer>
      </div>
    </>
  );
};
