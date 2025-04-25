import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneUtils } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Alert, Box, Button, CodeEditor, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans, t } from 'app/core/internationalization';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { DashboardDataDTO, SaveDashboardResponseDTO } from 'app/types';

import {
  NameAlreadyExistsError,
  isNameExistsError,
  isPluginDashboardError,
  isVersionMismatchError,
} from '../saving/shared';
import { useSaveDashboard } from '../saving/useSaveDashboard';
import { DashboardScene, isV2Dashboard } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface JsonModelEditViewState extends DashboardEditViewState {
  jsonText: string;
}

export class JsonModelEditView extends SceneObjectBase<JsonModelEditViewState> implements DashboardEditView {
  constructor(state: Omit<JsonModelEditViewState, 'jsonText' | 'initialJsonText'>) {
    super({
      ...state,
      jsonText: '',
    });

    this.addActivationHandler(() => this.setState({ jsonText: this.getJsonText() }));
  }
  public getUrlKey(): string {
    return 'json-model';
  }

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getSaveModel(): Dashboard | DashboardV2Spec {
    return this.getDashboard().getSaveModel();
  }

  public getJsonText(): string {
    const jsonData = this.getSaveModel();
    return getPrettyJSON(jsonData);
  }

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public onSaveSuccess = async (result: SaveDashboardResponseDTO) => {
    const jsonModel: DashboardDataDTO | DashboardV2Spec = JSON.parse(this.state.jsonText);
    const dashboard = this.getDashboard();

    const isV2 = isV2Dashboard(jsonModel);
    let newDashboardScene: DashboardScene;

    if (isV2) {
      // FIXME: We could avoid this call by storing the entire dashboard DTO as initial dashboard scene instead of only the spec and metadata
      const dto = await getDashboardAPI('v2').getDashboardDTO(result.uid);
      newDashboardScene = transformSaveModelSchemaV2ToScene(dto);
      const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state);

      dashboard.pauseTrackingChanges();
      dashboard.setInitialSaveModel(dto.spec, dto.metadata);
      dashboard.setState(newState);
    } else {
      jsonModel.version = result.version;
      newDashboardScene = transformSaveModelToScene({
        dashboard: jsonModel,
        meta: dashboard.state.meta,
      });
      const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state);

      dashboard.pauseTrackingChanges();
      dashboard.setInitialSaveModel(jsonModel, dashboard.state.meta);
      dashboard.setState(newState);
    }

    this.setState({ jsonText: this.getJsonText() });
  };

  static Component = ({ model }: SceneComponentProps<JsonModelEditView>) => {
    const { state, onSaveDashboard } = useSaveDashboard(false);
    const [isSaving, setIsSaving] = useState(false);

    const dashboard = model.getDashboard();

    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    const canSave = dashboard.useState().meta.canSave;
    const { jsonText } = model.useState();

    const onSave = async (overwrite: boolean) => {
      const result = await onSaveDashboard(dashboard, {
        folderUid: dashboard.state.meta.folderUid,
        overwrite,
        rawDashboardJSON: JSON.parse(model.state.jsonText),
        k8s: dashboard.state.meta.k8s,
      });

      setIsSaving(true);
      if (result.status === 'success') {
        await model.onSaveSuccess(result);
        setIsSaving(false);
      } else {
        setIsSaving(true);
      }
    };

    const saveButton = (overwrite: boolean) => (
      <Button
        type="submit"
        onClick={() => {
          onSave(overwrite);
        }}
        variant={overwrite ? 'destructive' : 'primary'}
      >
        {overwrite ? (
          <Trans i18nKey="dashboard-scene.json-model-edit-view.save-and-overwrite">'Save and overwrite'</Trans>
        ) : (
          <Trans i18nKey="dashboard-settings.json-editor.save-button">Save changes</Trans>
        )}
      </Button>
    );

    const cancelButton = (
      <Button variant="secondary" onClick={() => setIsSaving(false)} fill="outline">
        <Trans i18nKey="dashboard-scene.json-model-edit-view.cancel-button.cancel">Cancel</Trans>
      </Button>
    );
    const styles = useStyles2(getStyles);

    function renderSaveButtonAndError(error?: Error) {
      if (error && isSaving) {
        if (isVersionMismatchError(error)) {
          return (
            <Alert
              title={t(
                'dashboard-scene.json-model-edit-view.render-save-button-and-error.title-someone-else-has-updated-this-dashboard',
                'Someone else has updated this dashboard'
              )}
              severity="error"
            >
              <p>
                <Trans i18nKey="dashboard-scene.json-model-edit-view.render-save-button-and-error.would-still-dashboard">
                  Would you still like to save this dashboard?
                </Trans>
              </p>
              <Box paddingTop={2}>
                <Stack alignItems="center">
                  {cancelButton}
                  {saveButton(true)}
                </Stack>
              </Box>
            </Alert>
          );
        }

        if (isNameExistsError(error)) {
          return <NameAlreadyExistsError saveButton={saveButton} cancelButton={cancelButton} />;
        }

        if (isPluginDashboardError(error)) {
          return (
            <Alert
              title={t(
                'dashboard-scene.json-model-edit-view.render-save-button-and-error.title-plugin-dashboard',
                'Plugin dashboard'
              )}
              severity="error"
            >
              <p>
                <Trans i18nKey="dashboard-scene.json-model-edit-view.render-save-button-and-error.body-plugin-dashboard">
                  Your changes will be lost when you update the plugin. Use <strong>Save as</strong> to create custom
                  version.
                </Trans>
              </p>
              <Box paddingTop={2}>
                <Stack alignItems="center">{saveButton(true)}</Stack>
              </Box>
            </Alert>
          );
        }
      }

      return (
        <>
          {error && isSaving && (
            <Alert
              title={t(
                'dashboard-scene.json-model-edit-view.render-save-button-and-error.title-failed-to-save-dashboard',
                'Failed to save dashboard'
              )}
              severity="error"
            >
              <p>{error.message}</p>
            </Alert>
          )}
          <Stack alignItems="center">{saveButton(false)}</Stack>
        </>
      );
    }
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <div className={styles.wrapper}>
          <Trans i18nKey="dashboard-settings.json-editor.subtitle">
            The JSON model below is the data structure that defines the dashboard. This includes dashboard settings,
            panel settings, layout, queries, and so on.
          </Trans>
          <CodeEditor
            width="100%"
            value={jsonText}
            language="json"
            showLineNumbers={true}
            showMiniMap={true}
            containerStyles={styles.codeEditor}
            onBlur={model.onCodeEditorBlur}
          />
          {canSave && <Box paddingTop={2}>{renderSaveButtonAndError(state.error)}</Box>}
        </div>
      </Page>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  codeEditor: css({
    flexGrow: 1,
  }),
});
