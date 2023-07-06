import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { TimeZone } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CollapsableSection, Field, Input, RadioButtonGroup, TagsInput } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { FolderChange, ROOT_FOLDER } from 'app/core/components/NestedFolderPicker/types';
import { Page } from 'app/core/components/Page/Page';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { updateTimeZoneDashboard, updateWeekStartDashboard } from 'app/features/dashboard/state/actions';

import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';

import { TimePickerSettings } from './TimePickerSettings';
import { SettingsPageProps } from './types';

export type Props = SettingsPageProps & ConnectedProps<typeof connector>;

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export function GeneralSettingsUnconnected({
  dashboard,
  updateTimeZone,
  updateWeekStart,
  sectionNav,
}: Props): JSX.Element {
  const [renderCounter, setRenderCounter] = useState(0);

  const onFolderChange = (newFolder: FolderChange) => {
    dashboard.meta.folderUid = newFolder.uid === ROOT_FOLDER ? '' : newFolder.uid;
    dashboard.meta.folderTitle = newFolder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
    setRenderCounter(renderCounter + 1);
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (event.currentTarget.name === 'title' || event.currentTarget.name === 'description') {
      dashboard[event.currentTarget.name] = event.currentTarget.value;
    }
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
    <Page navModel={sectionNav}>
      <div style={{ maxWidth: '600px' }}>
        <div className="gf-form-group">
          <Field label="Name">
            <Input id="title-input" name="title" onBlur={onBlur} defaultValue={dashboard.title} />
          </Field>
          <Field label="Description">
            <Input id="description-input" name="description" onBlur={onBlur} defaultValue={dashboard.description} />
          </Field>
          <Field label="Tags">
            <TagsInput id="tags-input" tags={dashboard.tags} onChange={onTagsChange} width={40} />
          </Field>

          <Field label="Folder">
            {config.featureToggles.nestedFolderPicker ? (
              <NestedFolderPicker value={dashboard.meta.folderUid} onChange={onFolderChange} />
            ) : (
              <FolderPicker
                inputId="dashboard-folder-input"
                initialTitle={dashboard.meta.folderTitle}
                initialFolderUid={dashboard.meta.folderUid}
                onChange={onFolderChange}
                enableCreateNew={true}
                dashboardId={dashboard.id}
                skipInitialLoad={true}
              />
            )}
          </Field>

          <Field
            label="Editable"
            description="Set to read-only to disable all editing. Reload the dashboard for changes to take effect"
          >
            <RadioButtonGroup value={dashboard.editable} options={editableOptions} onChange={onEditableChange} />
          </Field>
        </div>

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

        {/* @todo: Update "Graph tooltip" description to remove prompt about reloading when resolving #46581 */}
        <CollapsableSection label="Panel options" isOpen={true}>
          <Field
            label="Graph tooltip"
            description="Controls tooltip and hover highlight behavior across different panels. Reload the dashboard for changes to take effect"
          >
            <RadioButtonGroup
              onChange={onTooltipChange}
              options={GRAPH_TOOLTIP_OPTIONS}
              value={dashboard.graphTooltip}
            />
          </Field>
        </CollapsableSection>

        <div className="gf-form-button-row">
          {dashboard.meta.canDelete && <DeleteDashboardButton dashboard={dashboard} />}
        </div>
      </div>
    </Page>
  );
}

const mapDispatchToProps = {
  updateTimeZone: updateTimeZoneDashboard,
  updateWeekStart: updateWeekStartDashboard,
};

const connector = connect(null, mapDispatchToProps);

export const GeneralSettings = connector(GeneralSettingsUnconnected);
