import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneUtils } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { Alert, Box, Button, CodeEditor, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import {
  NameAlreadyExistsError,
  isNameExistsError,
  isPluginDashboardError,
  isVersionMismatchError,
} from '../saving/shared';
import { useSaveDashboard } from '../saving/useSaveDashboard';
import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
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

  public getSaveModel(): Dashboard {
    const dashboard = this.getDashboard();
    return transformSceneToSaveModel(dashboard);
  }

  public getJsonText(): string {
    const jsonData = this.getSaveModel();
    return getPrettyJSON(jsonData);
  }

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public onSaveSuccess = (result: SaveDashboardResponseDTO) => {
    const jsonModel = JSON.parse(this.state.jsonText);
    const dashboard = this.getDashboard();
    jsonModel.version = result.version;

    const rsp: DashboardDTO = {
      dashboard: jsonModel,
      meta: dashboard.state.meta,
    };
    const newDashboardScene = transformSaveModelToScene(rsp);
    const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state);

    dashboard.pauseTrackingChanges();
    dashboard.setInitialSaveModel(rsp.dashboard);
    dashboard.setState(newState);

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
      const result = await onSaveDashboard(dashboard, JSON.parse(model.state.jsonText), {
        folderUid: dashboard.state.meta.folderUid,
        overwrite,
      });

      setIsSaving(true);
      if (result.status === 'success') {
        model.onSaveSuccess(result);
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
          'Save and overwrite'
        ) : (
          <Trans i18nKey="dashboard-settings.json-editor.save-button">Save changes</Trans>
        )}
      </Button>
    );

    const cancelButton = (
      <Button variant="secondary" onClick={() => setIsSaving(false)} fill="outline">
        Cancel
      </Button>
    );
    const styles = useStyles2(getStyles);

    function renderSaveButtonAndError(error?: Error) {
      if (error && isSaving) {
        if (isVersionMismatchError(error)) {
          return (
            <Alert title="Someone else has updated this dashboard" severity="error">
              <p>Would you still like to save this dashboard?</p>
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
            <Alert title="Plugin dashboard" severity="error">
              <p>
                Your changes will be lost when you update the plugin. Use <strong>Save As</strong> to create custom
                version.
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
            <Alert title="Failed to save dashboard" severity="error">
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
