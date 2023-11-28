import React, { ChangeEvent } from 'react';

import { PageLayoutType } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectRef,
  SceneTimePicker,
} from '@grafana/scenes';
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

import { DashboardControls } from '../scene/DashboardControls';
import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { DashboardEditView, useDashboardEditPageNav } from './utils';

export interface GeneralSettingsEditViewState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

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
  private get _dashboard(): DashboardScene {
    return this.state.dashboardRef.resolve();
  }

  public getUrlKey(): string {
    return 'settings';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getTimeZone() {
    return this._dashboard.state.$timeRange?.getTimeZone();
  }

  public getWeekStart() {
    return this._dashboard.state.$timeRange?.state.weekStart;
  }

  public getRefreshIntervals() {
    return dashboardSceneGraph.getRefreshPicker(this._dashboard)?.state.intervals;
  }

  public onTitleChange = (value: string) => {
    this._dashboard.setState({ title: value });
  };

  public onDescriptionChange = (value: string) => {
    this._dashboard.setState({ description: value });
  };

  public onTagsChange = (value: string[]) => {
    this._dashboard.setState({ tags: value });
  };

  public onFolderChange = (newUID: string, newTitle: string) => {
    const newMeta = {
      ...this._dashboard.state.meta,
      folderUid: newUID || this._dashboard.state.meta.folderUid,
      folderTitle: newTitle || this._dashboard.state.meta.folderTitle,
      hasUnsavedFolderChange: true,
    };

    this._dashboard.setState({ meta: newMeta });
  };

  public onEditableChange = (value: boolean) => {
    this._dashboard.setState({ editable: value });
  };

  public onTimeZoneChange = (value: TimeZone) => {
    this._dashboard.state.$timeRange?.setState({
      timeZone: value,
    });
  };

  public onWeekStartChange = (value: string) => {
    this._dashboard.state.$timeRange?.setState({
      weekStart: value,
    });
  };

  public onRefreshIntervalChange = (value: string[]) => {
    const control = dashboardSceneGraph.getRefreshPicker(this._dashboard);
    control?.setState({
      intervals: value,
    });
  };

  public onNowDelayChange = (value: string) => {
    // TODO: Figure out how to store nowDelay in Dashboard Scene
  };

  public onHideTimePickerChange = (value: boolean) => {
    if (this._dashboard.state.controls instanceof DashboardControls) {
      for (const control of this._dashboard.state.controls.state.timeControls) {
        if (control instanceof SceneTimePicker) {
          control.setState({
            // TODO: Control visibility from DashboardControls
            // hidden: value,
          });
        }
      }
    }
  };

  public onLiveNowChange = (value: boolean) => {
    // TODO: Figure out how to store liveNow in Dashboard Scene
  };

  public onTooltipChange = (value: number) => {
    this._dashboard.setState({ graphTooltip: value });
  };

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const { navModel, pageNav } = useDashboardEditPageNav(model.getDashboard(), model.getUrlKey());
    const { title, description, tags, meta, editable, graphTooltip, overlay } = model.getDashboard().useState();
    const {
      onTitleChange,
      onDescriptionChange,
      onTagsChange,
      onFolderChange,
      onEditableChange,
      onTimeZoneChange,
      onWeekStartChange,
      onRefreshIntervalChange,
      onNowDelayChange,
      onHideTimePickerChange,
      onLiveNowChange,
      onTooltipChange,
    } = model;

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={model.getDashboard()} />
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
                defaultValue={title}
                onBlur={(e: ChangeEvent<HTMLInputElement>) => onTitleChange(e.target.value)}
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
                defaultValue={description}
                onBlur={(e: ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(e.target.value)}
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
            refreshIntervals={model.getRefreshIntervals()}
            // TODO: Control visibility of time picker
            // timePickerHidden={timepicker?.state?.hidden}
            // TODO: Implement this in dashboard scene
            // nowDelay={timepicker.nowDelay || ''}
            // TODO: Implement this in dashboard scene
            // liveNow={liveNow}
            liveNow={false}
            timezone={model.getTimeZone() || ''}
            weekStart={model.getWeekStart() || ''}
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
        {overlay && <overlay.Component model={overlay} />}
      </Page>
    );
  };
}
