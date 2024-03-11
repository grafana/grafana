import React, { ChangeEvent } from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
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

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface GeneralSettingsEditViewState extends DashboardEditViewState {}

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
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'settings';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getTimeRange() {
    return sceneGraph.getTimeRange(this._dashboard);
  }

  public getRefreshPicker() {
    return this.getDashboardControls().state.refreshPicker;
  }

  public getCursorSync() {
    return dashboardSceneGraph.getCursorSync(this._dashboard);
  }

  public getDashboardControls() {
    return this._dashboard.state.controls!;
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

  public onFolderChange = (newUID: string | undefined, newTitle: string | undefined) => {
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
    this.getTimeRange().setState({
      timeZone: value,
    });
  };

  public onWeekStartChange = (value: string) => {
    this.getTimeRange().setState({
      weekStart: value,
    });
  };

  public onRefreshIntervalChange = (value: string[]) => {
    const control = this.getRefreshPicker();
    control?.setState({
      intervals: value,
    });
  };

  public onNowDelayChange = (value: string) => {
    const timeRange = this.getTimeRange();

    timeRange?.setState({
      UNSAFE_nowDelay: value,
    });
  };

  public onHideTimePickerChange = (value: boolean) => {
    this.getDashboardControls()?.setState({
      hideTimeControls: value,
    });
  };

  public onLiveNowChange = (value: boolean) => {
    // TODO: Figure out how to store liveNow in Dashboard Scene
  };

  public onTooltipChange = (value: number) => {
    this.getCursorSync()?.setState({ sync: value });
  };

  static Component = ({ model }: SceneComponentProps<GeneralSettingsEditView>) => {
    const { navModel, pageNav } = useDashboardEditPageNav(model.getDashboard(), model.getUrlKey());
    const { title, description, tags, meta, editable } = model.getDashboard().useState();
    const { sync: graphTooltip } = model.getCursorSync()?.useState() || {};
    const { timeZone, weekStart, UNSAFE_nowDelay: nowDelay } = model.getTimeRange().useState();
    const { intervals } = model.getRefreshPicker().useState();
    const { hideTimeControls } = model.getDashboardControls().useState();

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
                onBlur={(e: ChangeEvent<HTMLInputElement>) => model.onTitleChange(e.target.value)}
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
                onBlur={(e: ChangeEvent<HTMLTextAreaElement>) => model.onDescriptionChange(e.target.value)}
              />
            </Field>
            <Field label={t('dashboard-settings.general.tags-label', 'Tags')}>
              <TagsInput id="tags-input" tags={tags} onChange={model.onTagsChange} width={40} />
            </Field>
            <Field label={t('dashboard-settings.general.folder-label', 'Folder')}>
              <FolderPicker
                value={meta.folderUid}
                onChange={model.onFolderChange}
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
              <RadioButtonGroup value={editable} options={EDITABLE_OPTIONS} onChange={model.onEditableChange} />
            </Field>
          </Box>

          <TimePickerSettings
            onTimeZoneChange={model.onTimeZoneChange}
            onWeekStartChange={model.onWeekStartChange}
            onRefreshIntervalChange={model.onRefreshIntervalChange}
            onNowDelayChange={model.onNowDelayChange}
            onHideTimePickerChange={model.onHideTimePickerChange}
            onLiveNowChange={model.onLiveNowChange}
            refreshIntervals={intervals}
            timePickerHidden={hideTimeControls}
            nowDelay={nowDelay || ''}
            // TODO: Implement this in dashboard scene
            // liveNow={liveNow}
            liveNow={false}
            timezone={timeZone || ''}
            weekStart={weekStart || ''}
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
              <RadioButtonGroup onChange={model.onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} value={graphTooltip} />
            </Field>
          </CollapsableSection>

          <Box marginTop={3}>{meta.canDelete && <DeleteDashboardButton />}</Box>
        </div>
      </Page>
    );
  };
}
