import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { TimeZone } from '@grafana/data';
import { CollapsableSection, Field, Input, RadioButtonGroup, TagsInput } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DashboardModel } from '../../state/DashboardModel';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';
import { TimePickerSettings } from './TimePickerSettings';

import { updateTimeZoneDashboard, updateWeekStartDashboard } from 'app/features/dashboard/state/actions';
import { PreviewSettings } from './PreviewSettings';
import { config } from '@grafana/runtime';

interface OwnProps {
  dashboard: DashboardModel;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export function GeneralSettingsUnconnected({ dashboard, updateTimeZone, updateWeekStart }: Props): JSX.Element {
  const [renderCounter, setRenderCounter] = useState(0);

  const onFolderChange = (folder: { id: number; title: string }) => {
    dashboard.meta.folderId = folder.id;
    dashboard.meta.folderTitle = folder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    dashboard[event.currentTarget.name as 'title' | 'description'] = event.currentTarget.value;
  };

  const onTooltipChange = (graphTooltip: number) => {
    dashboard.graphTooltip = graphTooltip;
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

  const onLiveNowChange = (v: boolean) => {
    dashboard.liveNow = v;
    setRenderCounter(renderCounter + 1);
  };

  const onTimeZoneChange = (timeZone: TimeZone) => {
    dashboard.timezone = timeZone;
    setRenderCounter(renderCounter + 1);
    updateTimeZone(timeZone);
  };

  const onWeekStartChange = (weekStart: string) => {
    dashboard.weekStart = weekStart;
    setRenderCounter(renderCounter + 1);
    updateWeekStart(weekStart);
  };

  const onTagsChange = (tags: string[]) => {
    dashboard.tags = tags;
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
          <Input id="title-input" name="title" onBlur={onBlur} defaultValue={dashboard.title} />
        </Field>
        <Field label="Description">
          <Input id="description-input" name="description" onBlur={onBlur} defaultValue={dashboard.description} />
        </Field>
        <Field label="Tags">
          <TagsInput id="tags-input" tags={dashboard.tags} onChange={onTagsChange} />
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

      {config.featureToggles.dashboardPreviews && <PreviewSettings uid={dashboard.uid} />}

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
        liveNow={dashboard.liveNow}
      />

      <CollapsableSection label="Panel options" isOpen={true}>
        <Field
          label="Graph tooltip"
          description="Controls tooltip and hover highlight behavior across different panels"
        >
          <RadioButtonGroup onChange={onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} value={dashboard.graphTooltip} />
        </Field>
      </CollapsableSection>

      <div className="gf-form-button-row">
        {dashboard.meta.canSave && <DeleteDashboardButton dashboard={dashboard} />}
      </div>
    </div>
  );
}

const mapDispatchToProps = {
  updateTimeZone: updateTimeZoneDashboard,
  updateWeekStart: updateWeekStartDashboard,
};

const connector = connect(null, mapDispatchToProps);

export const GeneralSettings = connector(GeneralSettingsUnconnected);
