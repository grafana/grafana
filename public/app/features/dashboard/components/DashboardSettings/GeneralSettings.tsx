import { useCallback, ChangeEvent, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { TimeZone } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  CollapsableSection,
  Field,
  Input,
  RadioButtonGroup,
  TagsInput,
  Label,
  TextArea,
  Box,
  Stack,
  WeekStart,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { updateTimeZoneDashboard, updateWeekStartDashboard } from 'app/features/dashboard/state/actions';

import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';
import { GenAIDashDescriptionButton } from '../GenAI/GenAIDashDescriptionButton';
import { GenAIDashTitleButton } from '../GenAI/GenAIDashTitleButton';

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
  const [dashboardTitle, setDashboardTitle] = useState(dashboard.title);
  const [dashboardDescription, setDashboardDescription] = useState(dashboard.description);
  const pageNav = sectionNav.node.parentItem;

  const onFolderChange = (newUID: string | undefined, newTitle: string | undefined) => {
    dashboard.meta.folderUid = newUID;
    dashboard.meta.folderTitle = newTitle;
    dashboard.meta.hasUnsavedFolderChange = true;
    setRenderCounter(renderCounter + 1);
  };

  const onTitleChange = useCallback(
    (title: string) => {
      dashboard.title = title;
      setDashboardTitle(title);
    },
    [setDashboardTitle, dashboard]
  );

  const onDescriptionChange = useCallback(
    (description: string) => {
      dashboard.description = description;
      setDashboardDescription(description);
    },
    [setDashboardDescription, dashboard]
  );

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

  const onWeekStartChange = (weekStart?: WeekStart) => {
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
    <Page navModel={sectionNav} pageNav={pageNav}>
      <div style={{ maxWidth: '600px' }}>
        <Box marginBottom={5}>
          <Field
            label={
              <Stack justifyContent="space-between">
                <Label htmlFor="title-input">
                  <Trans i18nKey="dashboard-settings.general.title-label">Title</Trans>
                </Label>

                {config.featureToggles.dashgpt && <GenAIDashTitleButton onGenerate={onTitleChange} />}
              </Stack>
            }
          >
            <Input
              id="title-input"
              name="title"
              value={dashboardTitle}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onTitleChange(e.target.value)}
            />
          </Field>
          <Field
            label={
              <Stack justifyContent="space-between">
                <Label htmlFor="description-input">
                  {t('dashboard-settings.general.description-label', 'Description')}
                </Label>

                {config.featureToggles.dashgpt && <GenAIDashDescriptionButton onGenerate={onDescriptionChange} />}
              </Stack>
            }
          >
            <TextArea
              id="description-input"
              name="description"
              value={dashboardDescription}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(e.target.value)}
            />
          </Field>
          <Field label={t('dashboard-settings.general.tags-label', 'Tags')}>
            <TagsInput id="tags-input" tags={dashboard.tags} onChange={onTagsChange} width={40} />
          </Field>

          <Field label={t('dashboard-settings.general.folder-label', 'Folder')}>
            <FolderPicker
              value={dashboard.meta.folderUid}
              onChange={onFolderChange}
              // TODO deprecated props that can be removed once NestedFolderPicker is enabled by default
              initialTitle={dashboard.meta.folderTitle}
              inputId="dashboard-folder-input"
              enableCreateNew
              dashboardId={dashboard.id}
              skipInitialLoad
            />
          </Field>

          <Field
            label={t('dashboard-settings.general.editable-label', 'Editable')}
            description={t(
              'dashboard-settings.general.editable-description',
              'Set to read-only to disable all editing. Reload the dashboard for changes to take effect'
            )}
          >
            <RadioButtonGroup value={dashboard.editable} options={editableOptions} onChange={onEditableChange} />
          </Field>
        </Box>

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
        <CollapsableSection label={t('dashboard-settings.general.panel-options-label', 'Panel options')} isOpen={true}>
          <Field
            label={t('dashboard-settings.general.panel-options-graph-tooltip-label', 'Graph tooltip')}
            description={t(
              'dashboard-settings.general.panel-options-graph-tooltip-description',
              'Controls tooltip and hover highlight behavior across different panels. Reload the dashboard for changes to take effect'
            )}
          >
            <RadioButtonGroup
              onChange={onTooltipChange}
              options={GRAPH_TOOLTIP_OPTIONS}
              value={dashboard.graphTooltip}
            />
          </Field>
        </CollapsableSection>

        <Box marginTop={3}>{dashboard.meta.canDelete && <DeleteDashboardButton />}</Box>
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
