import React, { useState } from 'react';
import { SelectableValue, TimeZone } from '@grafana/data';
import { Select, InlineSwitch, TagsInput, InlineField, Input } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DashboardModel } from '../../state/DashboardModel';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';
import { TimePickerSettings } from './TimePickerSettings';

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
      <h3 className="dashboard-settings__header" aria-label={selectors.pages.Dashboard.Settings.General.title}>
        General
      </h3>
      <div className="gf-form-group">
        <InlineField label="Name" labelWidth={14}>
          <Input name="title" onBlur={onBlur} defaultValue={dashboard.title} width={60} />
        </InlineField>
        <InlineField label="Description" labelWidth={14}>
          <Input name="description" onBlur={onBlur} defaultValue={dashboard.description} width={60} />
        </InlineField>
        <InlineField label="Tags" tooltip="Press enter to add a tag" labelWidth={14}>
          <TagsInput tags={dashboard.tags} onChange={onTagsChange} />
        </InlineField>
        <FolderPicker
          initialTitle={dashboard.meta.folderTitle}
          initialFolderId={dashboard.meta.folderId}
          onChange={onFolderChange}
          enableCreateNew={true}
          dashboardId={dashboard.id}
        />
        <InlineField
          label="Editable"
          tooltip="Uncheck, then save and reload to disable all dashboard editing"
          labelWidth={14}
        >
          <InlineSwitch value={dashboard.editable} onChange={onEditableChange} />
        </InlineField>
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
        <InlineField label="Graph Tooltip" labelWidth={14}>
          <Select
            onChange={onTooltipChange}
            options={GRAPH_TOOLTIP_OPTIONS}
            width={40}
            value={dashboard.graphTooltip}
          />
        </InlineField>
      </div>
      <div className="gf-form-button-row">
        {dashboard.meta.canSave && <DeleteDashboardButton dashboard={dashboard} />}
      </div>
    </>
  );
};
