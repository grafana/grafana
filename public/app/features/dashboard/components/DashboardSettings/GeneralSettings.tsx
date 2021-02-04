import React, { useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { DashboardModel } from '../../state/DashboardModel';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { TimePickerSettings } from './TimePickerSettings';
import { TimeZone } from '@grafana/data';
import { Select, Switch, TagsInput } from '@grafana/ui';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';

interface Props {
  dashboard: DashboardModel;
}

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export const GeneralSettings: React.FC<Props> = ({ dashboard }) => {
  const [renderCounter, setRenderCounter] = useState(0);

  const onFolderChange = (folder: { id: number; title: string }) => {
    dashboard.meta.folderId = folder.id;
    dashboard.meta.folderTitle = folder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    dashboard[event.currentTarget.name as 'title' | 'description'] = event.currentTarget.value;
  };

  const onTooltipChange = (graphTooltip: SelectableValue<number>) => {
    dashboard.graphTooltip = graphTooltip.value;
    setRenderCounter(renderCounter + 1);
  };

  const onRefreshIntervalChange = (intervals: string[]) => {
    dashboard.timepicker.refresh_intervals = intervals.filter((i) => i.trim() !== '');
  };

  const onNowDelayChange = (nowDelay: string) => {
    dashboard.timepicker.nowDelay = nowDelay;
  };

  const onHideTimePickerChange = (hide: boolean) => {
    dashboard.timepicker.hidden = hide;
    setRenderCounter(renderCounter + 1);
  };

  const onTimeZoneChange = (timeZone: TimeZone) => {
    dashboard.timezone = timeZone;
    setRenderCounter(renderCounter + 1);
  };

  const onTagsChange = (tags: string[]) => {
    dashboard.tags = tags;
  };

  const onEditableChange = (ev: React.FormEvent<HTMLInputElement>) => {
    dashboard.editable = ev.currentTarget.checked;
    setRenderCounter(renderCounter + 1);
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
        <div className="gf-form">
          <label className="gf-form-label width-7">Tags</label>
          <TagsInput tags={dashboard.tags} onChange={onTagsChange} />
        </div>
        <FolderPicker
          initialTitle={dashboard.meta.folderTitle}
          initialFolderId={dashboard.meta.folderId}
          onChange={onFolderChange}
          enableCreateNew={true}
          dashboardId={dashboard.id}
        />
        <div className="gf-form">
          <label className="gf-form-label width-7">Editable</label>
          <Switch value={dashboard.editable} onChange={onEditableChange} />
        </div>
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
        {dashboard.meta.canSave && <DeleteDashboardButton dashboard={dashboard} />}
      </div>
    </>
  );
};
