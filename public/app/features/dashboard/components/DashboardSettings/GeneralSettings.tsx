import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { DashboardCursorSync, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { CollapsableSection, Field, Input, RadioButtonGroup, TagsInput } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import {
  updateTimeZoneDashboard as updateTimeZone,
  updateWeekStartDashboard as updateWeekStart,
} from 'app/features/dashboard/state/actions';
import { StoreState } from 'app/types';

import { DashboardModel } from '../../state/DashboardModel';
import { updateDashboard } from '../../state/reducers';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';

import { PreviewSettings } from './PreviewSettings';
import { TimePickerSettings } from './TimePickerSettings';

export interface Props {
  dashboard: DashboardModel;
}

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export function GeneralSettings({ dashboard }: Props): JSX.Element {
  const [renderCounter, setRenderCounter] = useState(0);
  const dispatch = useDispatch();
  const { title, liveNow, graphTooltip, description, tags } = useSelector((state: StoreState) => state.dashboard);

  const onFolderChange = (folder: { id: number; title: string }) => {
    dashboard.meta.folderId = folder.id;
    dashboard.meta.folderTitle = folder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    dashboard[event.currentTarget.name as 'title' | 'description'] = event.currentTarget.value;
  };

  const onTooltipChange = (graphTooltip: DashboardCursorSync) => {
    dispatch(updateDashboard({ graphTooltip }));
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

  const onLiveNowChange = (v: boolean) => {
    dispatch(updateDashboard({ liveNow: v }));
  };

  const onTimeZoneChange = (timeZone: TimeZone) => {
    dashboard.timezone = timeZone;
    setRenderCounter(renderCounter + 1);
    dispatch(updateTimeZone(timeZone));
  };

  const onWeekStartChange = (weekStart: string) => {
    dashboard.weekStart = weekStart;
    setRenderCounter(renderCounter + 1);
    dispatch(updateWeekStart(weekStart));
  };

  const onTagsChange = (tags: string[]) => {
    dispatch(updateDashboard({ tags }));
    setRenderCounter(renderCounter + 1);
  };

  const onEditableChange = (value: boolean) => {
    dashboard.editable = value;
    setRenderCounter(renderCounter + 1);
  };

  const editableOptions = [
    { label: 'Editable', value: true },
    { label: 'Read-only', value: false },
  ];

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 className="dashboard-settings__header" aria-label={selectors.pages.Dashboard.Settings.General.title}>
        General
      </h3>
      <div className="gf-form-group">
        <Field label="Name">
          <Input id="title-input" name="title" onBlur={onBlur} defaultValue={title} />
        </Field>
        <Field label="Description">
          <Input id="description-input" name="description" onBlur={onBlur} defaultValue={description} />
        </Field>
        <Field label="Tags">
          <TagsInput id="tags-input" tags={tags} onChange={onTagsChange} />
        </Field>
        <Field label="Folder">
          <FolderPicker
            inputId="dashboard-folder-input"
            initialTitle={dashboard.meta.folderTitle}
            initialFolderId={dashboard.meta.folderId}
            onChange={onFolderChange}
            enableCreateNew={true}
            dashboardId={dashboard.id}
            skipInitialLoad={true}
          />
        </Field>

        <Field
          label="Editable"
          description="Set to read-only to disable all editing. Reload the dashboard for changes to take effect"
        >
          <RadioButtonGroup value={dashboard.editable} options={editableOptions} onChange={onEditableChange} />
        </Field>
      </div>

      {config.featureToggles.dashboardPreviews && config.featureToggles.dashboardPreviewsAdmin && (
        <PreviewSettings uid={dashboard.uid} />
      )}

      <TimePickerSettings
        onTimeZoneChange={onTimeZoneChange}
        onWeekStartChange={onWeekStartChange}
        onRefreshIntervalChange={onRefreshIntervalChange}
        onNowDelayChange={onNowDelayChange}
        onHideTimePickerChange={onHideTimePickerChange}
        onLiveNowChange={onLiveNowChange}
        refreshIntervals={dashboard.timepicker.refresh_intervals}
        timePickerHidden={dashboard.timepicker.hidden}
        nowDelay={dashboard.timepicker.nowDelay}
        timezone={dashboard.timezone}
        weekStart={dashboard.weekStart}
        liveNow={liveNow}
      />

      <CollapsableSection label="Panel options" isOpen={true}>
        <Field
          label="Graph tooltip"
          description="Controls tooltip and hover highlight behavior across different panels"
        >
          <RadioButtonGroup onChange={onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} value={graphTooltip} />
        </Field>
      </CollapsableSection>

      <div className="gf-form-button-row">
        {dashboard.meta.canDelete && <DeleteDashboardButton dashboard={dashboard} />}
      </div>
    </div>
  );
}
