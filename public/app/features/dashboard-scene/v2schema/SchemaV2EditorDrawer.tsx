import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef, sceneUtils } from '@grafana/scenes';
import { Alert, Box, Button, Drawer, useStyles2 } from '@grafana/ui';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from '../edit-pane/shared';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

import { DashboardSchemaEditor } from './DashboardSchemaEditor';

interface SchemaV2EditorDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  jsonText: string;
}

export class SchemaV2EditorDrawer extends SceneObjectBase<SchemaV2EditorDrawerState> {
  constructor(state: Omit<SchemaV2EditorDrawerState, 'jsonText'>) {
    super({
      ...state,
      jsonText: '',
    });

    this.addActivationHandler(() => this.setState({ jsonText: this.getJsonText() }));
  }

  private getJsonText(): string {
    const dashboard = this.state.dashboardRef.resolve();
    const spec = transformSceneToSaveModelSchemaV2(dashboard);
    return JSON.stringify(spec, null, 2);
  }

  public onClose = () => {
    const dashboard = this.state.dashboardRef.resolve();
    dashboard.setState({ overlay: undefined });
  };

  /**
   * Applies the JSON from the editor to the dashboard.
   * Returns success status and optional error message.
   */
  public onApply = (jsonText: string): { success: boolean; error?: string } => {
    const dashboard = this.state.dashboardRef.resolve();

    try {
      const spec = JSON.parse(jsonText);

      // Build a DTO for the transformation function
      const dto = {
        apiVersion: 'v2beta1' as const,
        kind: 'Dashboard' as const,
        metadata: dashboard.state.meta.k8s ?? {
          name: dashboard.state.uid ?? '',
          namespace: 'default',
          resourceVersion: '',
          creationTimestamp: '',
        },
        spec,
        access: {
          canSave: dashboard.state.meta.canSave ?? false,
          canEdit: dashboard.state.meta.canEdit ?? false,
          canAdmin: dashboard.state.meta.canAdmin ?? false,
          canStar: dashboard.state.meta.canStar ?? false,
          canDelete: dashboard.state.meta.canDelete ?? false,
          canShare: dashboard.state.meta.canShare ?? false,
        },
      };

      // Capture previous state for undo
      const previousState = sceneUtils.cloneSceneObjectState(dashboard.state);

      // Transform JSON to scene
      const newDashboardScene = transformSaveModelSchemaV2ToScene(dto);
      const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state, { key: dashboard.state.key });

      // Enter edit mode if not already
      if (!dashboard.state.isEditing) {
        dashboard.onEnterEditMode();
      }

      // Apply the new state
      dashboard.setState(newState);

      // Mark as dirty
      dashboard.setState({ isDirty: true });

      // Publish event for undo/redo tracking
      dashboard.publishEvent(
        new DashboardEditActionEvent({
          source: dashboard,
          description: t('dashboard.schema-editor.undo-title', 'Schema edit'),
          perform: () => {
            dashboard.setState(newState);
          },
          undo: () => {
            dashboard.setState(previousState);
          },
        }),
        true
      );

      // Notify of state change
      dashboard.publishEvent(new DashboardStateChangedEvent({ source: dashboard }), true);

      // Update the JSON text in state
      this.setState({ jsonText });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  };

  static Component = SchemaV2EditorDrawerComponent;
}

interface SchemaV2EditorDrawerComponentProps extends SceneComponentProps<SchemaV2EditorDrawer> {}

function SchemaV2EditorDrawerComponent({ model }: SchemaV2EditorDrawerComponentProps) {
  const { jsonText } = model.useState();
  const styles = useStyles2(getStyles);

  const [hasValidationErrors, setHasValidationErrors] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [localJsonText, setLocalJsonText] = useState(jsonText);

  // Sync local state when model state changes
  useEffect(() => {
    setLocalJsonText(jsonText);
  }, [jsonText]);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasValidationErrors(hasErrors);
  }, []);

  const handleChange = useCallback((value: string) => {
    setLocalJsonText(value);
    setApplyError(null);
  }, []);

  const handleApply = useCallback(() => {
    setApplyError(null);
    const result = model.onApply(localJsonText);
    if (!result.success) {
      setApplyError(result.error ?? 'Failed to apply changes');
    } else {
      // Close the drawer on success
      model.onClose();
    }
  }, [model, localJsonText]);

  const isApplyDisabled = hasValidationErrors;

  return (
    <Drawer
      title={t('dashboard.schema-editor.title', 'Edit as code')}
      subtitle={t(
        'dashboard.schema-editor.subtitle',
        'Edit dashboard using v2 schema. Changes are applied to the current session but not saved to the database.'
      )}
      onClose={model.onClose}
      scrollableContent={false}
    >
      <div className={styles.wrapper}>
        {applyError && (
          <Alert title={t('dashboard.schema-editor.apply-error-title', 'Failed to apply changes')} severity="error">
            {applyError}
          </Alert>
        )}

        <div className={styles.editorContainer}>
          <DashboardSchemaEditor
            value={localJsonText}
            onChange={handleChange}
            onValidationChange={handleValidationChange}
            containerStyles={styles.codeEditor}
          />
        </div>

        <Box paddingTop={2}>
          <Button onClick={handleApply} disabled={isApplyDisabled}>
            {t('dashboard.schema-editor.apply-button', 'Apply changes')}
          </Button>
        </Box>
      </div>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  editorContainer: css({
    flexGrow: 1,
    minHeight: 0,
  }),
  codeEditor: css({
    height: '100%',
  }),
});
