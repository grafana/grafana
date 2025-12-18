import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/src/schema/dashboard/v2';
import { Alert, Button, Sidebar, Tooltip, useStyles2 } from '@grafana/ui';

import { DashboardWithAccessInfo } from '../../dashboard/api/types';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardSchemaEditor } from '../v2schema/DashboardSchemaEditor';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './shared';

export interface DashboardCodePaneProps {
  dashboard: DashboardScene;
}

export function DashboardCodePane({ dashboard }: DashboardCodePaneProps) {
  const styles = useStyles2(getStyles);

  const [hasValidationErrors, setHasValidationErrors] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() => getJsonText(dashboard));

  // Update JSON when dashboard changes
  useEffect(() => {
    setJsonText(getJsonText(dashboard));
  }, [dashboard]);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasValidationErrors(hasErrors);
  }, []);

  const handleChange = useCallback((value: string) => {
    setJsonText(value);
    setApplyError(null);
  }, []);

  const handleApply = useCallback(() => {
    setApplyError(null);
    const result = applyJsonToDashboard(dashboard, jsonText);
    if (!result.success) {
      setApplyError(result.error ?? 'Failed to apply changes');
    }
  }, [dashboard, jsonText]);

  const isApplyDisabled = hasValidationErrors;

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.code-pane.header', 'Edit as code')} />
      <div className={styles.content}>
        {applyError && (
          <Alert
            title={t('dashboard.schema-editor.apply-error-title', 'Failed to apply changes')}
            severity="error"
            topSpacing={0}
            bottomSpacing={0}
          >
            {applyError}
          </Alert>
        )}

        <div className={styles.editorContainer}>
          <DashboardSchemaEditor
            value={jsonText}
            onChange={handleChange}
            onValidationChange={handleValidationChange}
            containerStyles={styles.codeEditor}
            showFormatToggle={true}
            showMiniMap={false}
            showValidationAlert={false}
          />
        </div>

        <div className={styles.buttonContainer}>
          <Tooltip
            content={t(
              'dashboard.schema-editor.apply-button-disabled-tooltip',
              'Fix validation errors before applying changes'
            )}
            placement="top"
            show={isApplyDisabled ? undefined : false}
          >
            <Button onClick={handleApply} disabled={isApplyDisabled} size="sm">
              {t('dashboard.schema-editor.apply-button', 'Apply changes')}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function getJsonText(dashboard: DashboardScene): string {
  const spec = transformSceneToSaveModelSchemaV2(dashboard);
  return JSON.stringify(spec, null, 2);
}

function applyJsonToDashboard(dashboard: DashboardScene, jsonText: string): { success: boolean; error?: string } {
  try {
    const spec = JSON.parse(jsonText);

    // Get existing metadata from serializer and access from dashboard meta
    const metadata = dashboard.serializer.metadata;
    const { meta } = dashboard.state;

    // Build a DTO for the transformation function - only spec changes, metadata/access stays the same
    const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
      apiVersion: 'v2beta1',
      kind: 'DashboardWithAccessInfo',
      metadata: {
        name: dashboard.state.uid ?? '',
        resourceVersion: '',
        creationTimestamp: '',
        ...metadata,
      },
      spec,
      access: {
        canSave: meta.canSave,
        canEdit: meta.canEdit,
        canAdmin: meta.canAdmin,
        canStar: meta.canStar,
        canDelete: meta.canDelete,
        canShare: meta.canShare,
        annotationsPermissions: meta.annotationsPermissions,
        url: meta.url,
        slug: meta.slug,
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

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    height: '100%',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  }),
  editorContainer: css({
    flex: 1,
    minHeight: 0,
  }),
  codeEditor: css({
    height: '100%',
  }),
  buttonContainer: css({
    flex: '0 0 auto',
  }),
});
