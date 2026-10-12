import { type ChangeEvent } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import {
  Box,
  CollapsableSection,
  Field,
  Input,
  Label,
  RadioButtonGroup,
  Stack,
  Switch,
  TagsInput,
  TextArea,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  LazyGenAIDashDescriptionButton,
  LazyGenAIDashTitleButton,
} from 'app/features/dashboard/components/GenAI/LazyGenAIButtons';
import { MoveProvisionedDashboardDrawer } from 'app/features/provisioning/components/Dashboards/MoveProvisionedDashboardDrawer';
import { ProvisioningAwareFolderPicker } from 'app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DeleteDashboardButton } from './DeleteDashboardButton';
import { type GeneralSettingsEditView } from './GeneralSettingsEditView';
import { TimePickerSettings } from './TimePickerSettings';
import { useDashboardEditPageNav } from './utils';

export function GeneralSettingsEditViewRenderer({ model }: SceneComponentProps<GeneralSettingsEditView>) {
  const dashboard = model.getDashboard();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const { title, description, tags, meta, editable } = dashboard.useState();
  const { showMoveModal, moveModalProps } = model.useState();
  const { sync: graphTooltip } = model.getCursorSync()?.useState() || {};
  const { timeZone, weekStart, UNSAFE_nowDelay: nowDelay } = model.getTimeRange().useState();
  const { intervals } = model.getRefreshPicker().useState();
  const { hideTimeControls } = model.getDashboardControls().useState();
  const { enabled: liveNow } = model.getLiveNowTimer().useState();
  const EDITABLE_OPTIONS = [
    {
      label: t('dashboard-scene.general-settings-edit-view.editable_options.label.editable', 'Editable'),
      value: true,
    },
    {
      label: t('dashboard-scene.general-settings-edit-view.editable_options.label.readonly', 'Read-only'),
      value: false,
    },
  ];

  const DEFAULT_GRID_OPTIONS = [
    {
      label: t('dashboard-scene.general-settings-edit-view.default_grid_options.label.auto', 'Auto grid'),
      value: AutoGridLayoutManager.descriptor.id,
    },
    {
      label: t('dashboard-scene.general-settings-edit-view.default_grid_options.label.custom', 'Custom grid'),
      value: DefaultGridLayoutManager.descriptor.id,
    },
  ];

  const defaultGrid = dashboard.getDefaultLayoutType();

  const GRAPH_TOOLTIP_OPTIONS = [
    {
      value: 0,
      label: t('dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.default', 'Default'),
    },
    {
      value: 1,
      label: t(
        'dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.shared-crosshair',
        'Shared crosshair'
      ),
    },
    {
      value: 2,
      label: t(
        'dashboard-scene.general-settings-edit-view.graph_tooltip_options.label.shared-tooltip',
        'Shared tooltip'
      ),
    },
  ];

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <div style={{ maxWidth: '600px' }}>
        <Box display="flex" direction="column" gap={2} marginBottom={5}>
          <Field
            noMargin
            label={
              <Stack justifyContent="space-between">
                <Label htmlFor="title-input">
                  <Trans i18nKey="dashboard-settings.general.title-label">Title</Trans>
                </Label>
                <LazyGenAIDashTitleButton onGenerate={(title) => model.onTitleChange(title)} />
              </Stack>
            }
          >
            <Input
              id="title-input"
              name="title"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => model.onTitleChange(e.target.value)}
            />
          </Field>
          <Field
            noMargin
            label={
              <Stack justifyContent="space-between">
                <Label htmlFor="description-input">
                  {t('dashboard-settings.general.description-label', 'Description')}
                </Label>
                <LazyGenAIDashDescriptionButton onGenerate={(description) => model.onDescriptionChange(description)} />
              </Stack>
            }
          >
            <TextArea
              id="description-input"
              name="description"
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => model.onDescriptionChange(e.target.value)}
            />
          </Field>
          <Field noMargin label={t('dashboard-settings.general.tags-label', 'Tags')}>
            <TagsInput id="tags-input" tags={tags} onChange={model.onTagsChange} width={40} />
          </Field>
          {!meta.isDashboardTemplate && (
            <Field noMargin label={t('dashboard-settings.general.folder-label', 'Folder')}>
              <ProvisioningAwareFolderPicker
                value={meta.folderUid}
                onChange={dashboard.isManagedRepository() ? model.onProvisionedFolderChange : model.onFolderChange}
                repositoryName={dashboard.getManagerIdentity()}
                excludeUIDs={meta?.folderUid ? [meta.folderUid] : undefined}
              />
            </Field>
          )}

          {/* Render here so move-form load errors appear under the Move field. */}
          {showMoveModal && moveModalProps && (
            <MoveProvisionedDashboardDrawer
              dashboard={dashboard}
              targetFolderUID={moveModalProps.targetFolderUID}
              targetFolderTitle={moveModalProps.targetFolderTitle}
              onDismiss={model.onMoveModalDismiss}
              onSuccess={model.onMoveSuccess}
            />
          )}

          <Field
            noMargin
            label={t('dashboard-settings.general.editable-label', 'Editable')}
            description={t(
              'dashboard-settings.general.editable-description',
              'Set to read-only to disable all editing. Reload the dashboard for changes to take effect'
            )}
          >
            <RadioButtonGroup value={editable} options={EDITABLE_OPTIONS} onChange={model.onEditableChange} />
          </Field>

          <Field
            noMargin
            label={t('dashboard-settings.general.default-grid-label', 'Default grid')}
            description={t(
              'dashboard-settings.general.default-grid-description',
              'Select layout type to be used for new rows and tabs'
            )}
          >
            <RadioButtonGroup value={defaultGrid} options={DEFAULT_GRID_OPTIONS} onChange={model.onDefaultGridChange} />
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
          liveNow={liveNow}
          timezone={timeZone || ''}
          weekStart={weekStart}
        />

        {/* @todo: Update "Graph tooltip" description to remove prompt about reloading when resolving #46581 */}
        <CollapsableSection label={t('dashboard-settings.general.panel-options-label', 'Panel options')} isOpen={true}>
          <Stack direction="column" gap={2}>
            <Field
              noMargin
              label={t('dashboard-settings.general.panel-options-graph-tooltip-label', 'Graph tooltip')}
              description={t(
                'dashboard-settings.general.panel-options-graph-tooltip-description',
                'Controls tooltip and hover highlight behavior across different panels. Reload the dashboard for changes to take effect'
              )}
            >
              <RadioButtonGroup onChange={model.onTooltipChange} options={GRAPH_TOOLTIP_OPTIONS} value={graphTooltip} />
            </Field>

            <Field
              noMargin
              label={t('dashboard-settings.general.panels-preload-label', 'Preload panels')}
              description={t(
                'dashboard-settings.general.panels-preload-description',
                'When enabled all panels will start loading as soon as the dashboard has been loaded.'
              )}
            >
              <Switch
                id="preload-panels-dashboards-toggle"
                value={dashboard.state.preload ?? false}
                onChange={(e) => model.onPreloadChange(e.currentTarget.checked)}
              />
            </Field>
          </Stack>
        </CollapsableSection>

        <Box marginTop={3}>{meta.canDelete && <DeleteDashboardButton dashboard={dashboard} />}</Box>
      </div>
    </Page>
  );
}
