import React, { ChangeEvent } from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { TimeZone } from '@grafana/schema';
import {
  Box,
  CollapsableSection,
  Field,
  HorizontalGroup,
  Input,
  Label,
  RadioButtonGroup,
  TagsInput,
  TextArea,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { TimePickerSettings } from 'app/features/dashboard/components/DashboardSettings/TimePickerSettings';
import { DeleteDashboardButton } from 'app/features/dashboard/components/DeleteDashboard/DeleteDashboardButton';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, useDashboardEditPageNav } from './utils';

export interface GeneralSettingsEditViewState extends SceneObjectState {}

const EDITABLE_OPTIONS = [
  { label: 'Editable', value: true },
  { label: 'Read-only', value: false },
];

const GRAPH_TOOLTIP_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 1, label: 'Shared crosshair' },
  { value: 2, label: 'Shared Tooltip' },
];

export class GeneralSettingsEditView
  extends SceneObjectBase<GeneralSettingsEditViewState>
  implements DashboardEditView
{
  public getUrlKey(): string {
    return 'settings';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    const { title, description, tags, meta, editable, timepicker, timezone, weekStart, liveNow, graphTooltip } =
      dashboard.useState();

    const onTitleChange = (value: string) => {
      dashboard.setState({ title: value });
    };

    const onDescriptionChange = (value: string) => {
      dashboard.setState({ description: value });
    };

    const onTagsChange = (value: string[]) => {
      dashboard.setState({ tags: value });
    };

    const onFolderChange = (newUID: string, newTitle: string) => {
      const newMeta = {
        ...meta,
        folderUid: newUID || meta.folderUid,
        folderTitle: newTitle || meta.folderTitle,
        hasUnsavedFolderChange: true,
      };

      dashboard.setState({ meta: newMeta });
    };

    const onEditableChange = (value: boolean) => {
      dashboard.setState({ editable: value });
    };

    const onTimeZoneChange = (value: TimeZone) => {
      dashboard.setState({ timezone: value });
    };

    const onWeekStartChange = (value: string) => {
      dashboard.setState({ weekStart: value });
    };

    const onRefreshIntervalChange = (value: string[]) => {
      dashboard.setState({
        timepicker: {
          ...timepicker,
          refresh_intervals: value,
        },
      });
    };

    const onNowDelayChange = (value: string) => {
      dashboard.setState({
        timepicker: {
          ...timepicker,
          nowDelay: value,
        },
      });
    };

    const onHideTimePickerChange = (value: boolean) => {
      dashboard.setState({
        timepicker: {
          ...timepicker,
          hidden: value,
        },
      });
    };

    const onLiveNowChange = (value: boolean) => {
      dashboard.setState({ liveNow: value });
    };

    const onTooltipChange = (value: number) => {
      dashboard.setState({ graphTooltip: value });
    };

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <div style={{ maxWidth: '600px' }}>
          <Box marginBottom={5}>
            <Field
              label={
                <HorizontalGroup justify="space-between">
                  <Label htmlFor="title-input">
                    <Trans i18nKey="dashboard-settings.general.title-label">Title</Trans>
                  </Label>
                  {/* TODO: Make the component use persisted model */}
                  {/* {config.featureToggles.dashgpt && (
                  <GenAIDashTitleButton onGenerate={onTitleChange} dashboard={dashboard} />
                )} */}
                </HorizontalGroup>
              }
            >
              <Input
                id="title-input"
                name="title"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onTitleChange(e.target.value)}
              />
            </Field>
            <Field
              label={
                <HorizontalGroup justify="space-between">
                  <Label htmlFor="description-input">
                    {t('dashboard-settings.general.description-label', 'Description')}
                  </Label>

                  {/* {config.featureToggles.dashgpt && (
                  <GenAIDashDescriptionButton onGenerate={onDescriptionChange} dashboard={dashboard} />
                )} */}
                </HorizontalGroup>
              }
            >
              <TextArea
                id="description-input"
                name="description"
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(e.target.value)}
              />
            </Field>
            <Field label={t('dashboard-settings.general.tags-label', 'Tags')}>
              <TagsInput id="tags-input" tags={tags} onChange={onTagsChange} width={40} />
            </Field>
            <Field label={t('dashboard-settings.general.folder-label', 'Folder')}>
              <FolderPicker
                value={meta.folderUid}
                onChange={onFolderChange}
                // TODO deprecated props that can be removed once NestedFolderPicker is enabled by default
                initialTitle={meta.folderTitle}
                inputId="dashboard-folder-input"
                enableCreateNew
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
              <RadioButtonGroup value={editable} options={EDITABLE_OPTIONS} onChange={onEditableChange} />
            </Field>
          </Box>

          <TimePickerSettings
            onTimeZoneChange={onTimeZoneChange}
            onWeekStartChange={onWeekStartChange}
            onRefreshIntervalChange={onRefreshIntervalChange}
            onNowDelayChange={onNowDelayChange}
            onHideTimePickerChange={onHideTimePickerChange}
            onLiveNowChange={onLiveNowChange}
            refreshIntervals={timepicker.refresh_intervals}
            timePickerHidden={timepicker.hidden}
            nowDelay={timepicker.nowDelay || ''}
            timezone={timezone}
            weekStart={weekStart}
            liveNow={liveNow}
          />

          {/* @todo: Update "Graph tooltip" description to remove prompt about reloading when resolving #46581 */}
          <CollapsableSection
            label={t('dashboard-settings.general.panel-options-label', 'Panel options')}
            isOpen={true}
          >
            <Field
              label={t('dashboard-settings.general.panel-options-graph-tooltip-label', 'Graph tooltip')}
              description={t(
                'dashboard-settings.general.panel-options-graph-tooltip-description',
                'Controls tooltip and hover highlight behavior across different panels. Reload the dashboard for changes to take effect'
              )}
            >
              <RadioButtonGroup onChange={onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} value={graphTooltip} />
            </Field>
          </CollapsableSection>

          <Box marginTop={3}>{meta.canDelete && <DeleteDashboardButton />}</Box>
        </div>
      </Page>
    );
  };
}
