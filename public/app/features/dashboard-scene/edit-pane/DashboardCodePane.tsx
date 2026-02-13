import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button, IconButton, Modal, Sidebar, Tooltip, useStyles2 } from '@grafana/ui';

import { DashboardWithAccessInfo } from '../../dashboard/api/types';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardSchemaEditor, type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './shared';

export interface DashboardCodePaneProps {
  dashboard: DashboardScene;
}

export function DashboardCodePane({ dashboard }: DashboardCodePaneProps) {
  const styles = useStyles2(getStyles);

  const [hasValidationErrors, setHasValidationErrors] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() => getJsonText(dashboard));
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorFormat, setEditorFormat] = useState<SchemaEditorFormat>('json');

  useEffect(() => {
    setJsonText(getJsonText(dashboard));
  }, [dashboard]);

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

  const applyTooltip =
    editorFormat === 'yaml'
      ? t(
          'dashboard.schema-editor.apply-button-disabled-tooltip-yaml',
          'Document has validation errors. Switch to JSON to see inline error details.'
        )
      : t('dashboard.schema-editor.apply-button-disabled-tooltip', 'Fix validation errors before applying changes');

  const applyButton = (
    <Tooltip content={applyTooltip} placement="top" show={hasValidationErrors ? undefined : false}>
      <Button onClick={handleApply} disabled={hasValidationErrors} size="sm">
        {t('dashboard.schema-editor.apply-button', 'Apply changes')}
      </Button>
    </Tooltip>
  );

  const errorAlert = applyError ? (
    <Alert
      title={t('dashboard.schema-editor.apply-error-title', 'Failed to apply changes')}
      severity="error"
      topSpacing={0}
      bottomSpacing={0}
    >
      {applyError}
    </Alert>
  ) : null;

  const editorProps = {
    value: jsonText,
    onChange: handleChange,
    onValidationChange: setHasValidationErrors,
    onFormatChange: setEditorFormat,
    showFormatToggle: true,
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.code-pane.header', 'Edit as code')} />
      <div className={styles.content}>
        {errorAlert}
        <div className={styles.editorContainer}>
          <DashboardSchemaEditor {...editorProps} containerStyles={styles.codeEditor} />
        </div>
        <div className={styles.toolbar}>
          {applyButton}
          <IconButton
            name="expand-arrows"
            size="sm"
            tooltip={t('dashboard.code-pane.expand', 'Expand editor')}
            onClick={() => setIsExpanded(true)}
          />
        </div>
      </div>

      {isExpanded && (
        <Modal
          title={t('dashboard.code-pane.modal-title', 'Edit dashboard as code')}
          isOpen
          onDismiss={() => setIsExpanded(false)}
          className={styles.modal}
          contentClassName={styles.modalContent}
          closeOnBackdropClick={false}
          closeOnEscape={false}
        >
          <div className={styles.modalEditorWrapper}>
            {errorAlert}
            <DashboardSchemaEditor {...editorProps} />
            <div className={styles.toolbar}>
              {applyButton}
              <IconButton
                name="compress-arrows"
                size="sm"
                tooltip={t('dashboard.code-pane.collapse', 'Collapse editor')}
                onClick={() => setIsExpanded(false)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function getJsonText(dashboard: DashboardScene): string {
  return JSON.stringify(transformSceneToSaveModelSchemaV2(dashboard), null, 2);
}

function applyJsonToDashboard(dashboard: DashboardScene, jsonText: string): { success: boolean; error?: string } {
  try {
    const spec = JSON.parse(jsonText);
    const { meta } = dashboard.state;

    const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
      apiVersion: 'v2beta1',
      kind: 'DashboardWithAccessInfo',
      metadata: {
        name: dashboard.state.uid ?? '',
        resourceVersion: '',
        creationTimestamp: '',
        ...dashboard.serializer.metadata,
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

    const previousState = sceneUtils.cloneSceneObjectState(dashboard.state);
    const newDashboardScene = transformSaveModelSchemaV2ToScene(dto);
    const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state, { key: dashboard.state.key });

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    dashboard.setState({ ...newState, isDirty: true });

    dashboard.publishEvent(
      new DashboardEditActionEvent({
        source: dashboard,
        description: t('dashboard.schema-editor.undo-title', 'Schema edit'),
        perform: () => dashboard.setState(newState),
        undo: () => dashboard.setState(previousState),
      }),
      true
    );
    dashboard.publishEvent(new DashboardStateChangedEvent({ source: dashboard }), true);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: '0 0 auto',
  }),
  modal: css({
    width: '90vw',
    height: '90vh',
    maxWidth: '90vw',
  }),
  modalContent: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  }),
  modalEditorWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: theme.spacing(1),
  }),
});
