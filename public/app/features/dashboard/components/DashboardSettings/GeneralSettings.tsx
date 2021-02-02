import React from 'react';
import { SelectableValue } from '@grafana/data';
import { DashboardModel } from '../../state/DashboardModel';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { TimePickerSettings } from './TimePickerSettings';
import { TimeZone } from '@grafana/data';
import { Select } from '@grafana/ui';

interface Props {
  dashboard: DashboardModel;
}

type Whatever = keyof DashboardModel;

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export const GeneralSettings: React.FC<Props> = ({ dashboard }) => {
  const onFolderChange = (folder: { id: number; title: string }) => {
    dashboard.meta.folderId = folder.id;
    dashboard.meta.folderTitle = folder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    dashboard[event.currentTarget.name] = event.currentTarget.value;
  };

  const onTooltipChange = (graphTooltip: SelectableValue<number>) => {
    dashboard.graphTooltip = graphTooltip.value;
  };

  const onRefreshIntervalChange = (intervals: string[]) => {
    dashboard.timepicker.refresh_intervals = intervals.filter((i) => i.trim() !== '');
  };

  const onNowDelayChange = (nowDelay: string) => {
    dashboard.timepicker.nowDelay = nowDelay;
  };

  const onHideTimePickerChange = (hide: boolean) => {
    dashboard.timepicker.hidden = hide;
  };

  const onTimeZoneChange = (timeZone: TimeZone) => {
    dashboard.timezone = timeZone;
  };

  return (
    <>
      <h3 className="dashboard-settings__header">General</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <label className="gf-form-label width-7">Name</label>
          <input
            name="title"
            onBlur={onBlur}
            type="text"
            className="gf-form-input width-30"
            defaultValue={dashboard.title}
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label width-7">Description</label>
          <input
            name="description"
            onBlur={onBlur}
            type="text"
            className="gf-form-input width-30"
            defaultValue={dashboard.description}
          ></input>
        </div>
        <FolderPicker
          initialTitle={dashboard.meta.folderTitle}
          initialFolderId={dashboard.meta.folderId}
          onChange={onFolderChange}
          enableCreateNew={true}
          dashboardId={dashboard.id}
        />
      </div>
      <TimePickerSettings
        onTimeZoneChange={onTimeZoneChange}
        onRefreshIntervalChange={onRefreshIntervalChange}
        onNowDelayChange={onNowDelayChange}
        onHideTimePickerChange={onHideTimePickerChange}
        refreshIntervals={dashboard.timepicker.refresh_intervals}
        timePickerHidden={dashboard.timepicker.hidden}
        nowDelay={dashboard.timepicker.nowDelay}
        timezone={dashboard.timezone}
      />

      <h5 className="section-heading">Panel Options</h5>
      <div className="gf-form">
        <label className="gf-form-label width-7">Graph Tooltip</label>
        <Select onChange={onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} width={40} value={dashboard.graphTooltip} />
      </div>
      <div className="gf-form-button-row">
        <button
          className="btn btn-danger"
          ng-click="ctrl.deleteDashboard()"
          ng-show="ctrl.canDelete"
          aria-label="Dashboard settings page delete dashboard button"
        >
          Delete Dashboard
        </button>
      </div>
    </>
  );
};
