import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EmbeddedScene, SceneFlexLayout, SceneTimeRange, type SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Button, ConfirmModal, Field, Stack, useStyles2 } from '@grafana/ui';
import {
  useCreateVariableMutation,
  useDeleteVariableMutation,
  useUpdateVariableMutation,
  type Variable,
} from 'app/api/clients/dashboard/v2beta1';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { sceneVariablesSetToSchemaV2Variables } from 'app/features/dashboard-scene/serialization/sceneVariablesSetToVariables';
import {
  createSceneVariableFromVariableModel,
  type TypedVariableModelV2,
} from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { VariableEditorForm } from 'app/features/dashboard-scene/settings/variables/VariableEditorForm';
import { type EditableVariableType, getVariableScene } from 'app/features/dashboard-scene/settings/variables/utils';
import { dispatch } from 'app/store/store';

import { recreateVariable } from './api';
import { useVariableNameCollisionCheck } from './useVariableNameCollisionCheck';
import {
  buildVariableResource,
  getNextAvailableVariableName,
  getVariableFolderPickerExcludeUIDs,
  getVariableFolderUid,
  getVariableKind,
  getVariableSpecName,
  toWireVariableSpec,
} from './utils';

export interface VariableEditorViewProps {
  /** The variable resource being edited; undefined when creating a new variable. */
  source?: Variable;
  /** Logical names of existing variables — used to pick a non-colliding default for new ones. */
  existingNames?: string[];
  onBack: () => void;
}

/**
 * Standalone editor for global/folder-scoped variables. Bridges the k8s Variable
 * resource to the scene-based VariableEditorForm used in dashboard settings: the
 * wire spec is converted to a SceneVariable hosted in a minimal detached scene
 * (variable set + time range so query editors can resolve context), and serialized
 * back to a VariableKind on save.
 */
export function VariableEditorView({ source, existingNames = [], onBack }: VariableEditorViewProps) {
  const styles = useStyles2(getStyles);
  const isNew = !source;
  // '' represents the root Dashboards folder (global scope), matching the
  // FolderPicker's uid for its root item so it renders as selected.
  const [folderUid, setFolderUid] = useState<string>(source ? (getVariableFolderUid(source) ?? '') : '');
  const [sceneVariable, setSceneVariable] = useState<SceneVariable>(() =>
    source
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        createSceneVariableFromVariableModel(getVariableKind(source) as TypedVariableModelV2)
      : getVariableScene('query', { name: getNextAvailableVariableName('query', existingNames) })
  );

  const [createVariable, { isLoading: isCreating }] = useCreateVariableMutation();
  const [updateVariable, { isLoading: isUpdating }] = useUpdateVariableMutation();
  const [deleteVariable, { isLoading: isDeleting }] = useDeleteVariableMutation();
  const [isRecreating, setIsRecreating] = useState(false);
  const [hasNameError, setHasNameError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Keep delete out of isSaving so the Save button doesn't flash "Saving..." mid-delete.
  const isSaving = isCreating || isUpdating || isRecreating;
  const isBusy = isSaving || isDeleting;

  const { name: logicalName } = sceneVariable.useState();
  const { isChecking: isCheckingName, collisionError } = useVariableNameCollisionCheck(
    logicalName,
    folderUid,
    source?.metadata.name,
    hasNameError
  );
  const canSave = !isBusy && !hasNameError && !collisionError && !isCheckingName;

  const scene = useMemo(
    () =>
      new EmbeddedScene({
        $timeRange: new SceneTimeRange({}),
        $variables: new SceneVariableSet({ variables: [sceneVariable] }),
        body: new SceneFlexLayout({ children: [] }),
      }),
    [sceneVariable]
  );

  useEffect(() => {
    const deactivate = scene.activate();
    return deactivate;
  }, [scene]);

  const onTypeChange = (type: EditableVariableType) => {
    const { name, label } = sceneVariable.state;
    setSceneVariable(getVariableScene(type, { name, label }));
    // The new scene carries over the last committed (valid) name.
    setHasNameError(false);
  };

  const onSave = async () => {
    const variableSet = scene.state.$variables;
    if (!(variableSet instanceof SceneVariableSet)) {
      return;
    }

    const [kind] = sceneVariablesSetToSchemaV2Variables(variableSet, true);
    if (!kind || !kind.spec.name) {
      return;
    }

    // Failed mutations already surface an error notification via the enhanced
    // RTK endpoints, so rejections are swallowed and the editor stays open.
    try {
      if (isNew) {
        await createVariable({ variable: buildVariableResource(kind, folderUid) }).unwrap();
        onBack();
        return;
      }

      const sourceName = source.metadata.name;
      if (!sourceName) {
        return;
      }

      const sourceFolderUid = getVariableFolderUid(source) ?? '';
      if (kind.spec.name === getVariableSpecName(source) && folderUid === sourceFolderUid) {
        await updateVariable({ name: sourceName, patch: { spec: toWireVariableSpec(kind) } }).unwrap();
        onBack();
        return;
      }

      // Renaming or moving is a create-then-delete under the hood; surface it as
      // a single operation instead of separate "created" + "deleted" toasts.
      setIsRecreating(true);
      let recreateResult;
      try {
        recreateResult = await recreateVariable(sourceName, kind, folderUid || undefined);
      } finally {
        setIsRecreating(false);
      }
      // When the original could not be removed, recreateVariable already surfaced
      // a warning about the leftover copy — a success toast would contradict it.
      if (recreateResult.deletedOriginal) {
        dispatch(
          notifyApp(
            createSuccessNotification(
              folderUid !== sourceFolderUid
                ? t('variables-management.editor.moved', 'Variable moved')
                : t('variables-management.editor.updated', 'Variable updated')
            )
          )
        );
      }
      onBack();
    } catch {
      // Error already notified.
    }
  };

  const onDelete = async () => {
    try {
      if (source?.metadata.name) {
        await deleteVariable({ name: source.metadata.name }).unwrap();
      }
      onBack();
    } catch {
      // Error already notified.
    }
  };

  return (
    <div className={styles.container}>
      <Field
        noMargin
        className={styles.folderField}
        label={t('variables-management.editor.folder-label', 'Folder')}
        description={t(
          'variables-management.editor.folder-description',
          'Scope the variable to a folder, or choose the root Dashboards folder to make it global (available everywhere in the organization)'
        )}
      >
        <FolderPicker
          showRootFolder
          value={folderUid}
          onChange={(uid) => setFolderUid(uid ?? '')}
          excludeUIDs={getVariableFolderPickerExcludeUIDs()}
        />
      </Field>

      <VariableEditorForm
        // Remount on type change (new scene key) so the form's name-error state and
        // uncontrolled inputs reset with the committed name — same as dashboard settings.
        key={sceneVariable.state.key}
        variable={sceneVariable}
        onTypeChange={onTypeChange}
        onGoBack={onBack}
        onDelete={onDelete}
        onNameErrorChange={setHasNameError}
        externalNameError={collisionError}
        standalone
      />

      <Stack gap={2}>
        <Button variant="primary" onClick={onSave} disabled={!canSave}>
          {isSaving
            ? t('variables-management.editor.saving', 'Saving...')
            : t('variables-management.editor.save', 'Save')}
        </Button>
        <Button variant="secondary" fill="outline" onClick={onBack} disabled={isBusy}>
          <Trans i18nKey="variables-management.editor.cancel">Cancel</Trans>
        </Button>
        {!isNew && (
          <Button variant="destructive" fill="outline" onClick={() => setShowDeleteModal(true)} disabled={isBusy}>
            <Trans i18nKey="variables-management.editor.delete">Delete</Trans>
          </Button>
        )}
      </Stack>

      {showDeleteModal && (
        <ConfirmModal
          isOpen
          title={t('variables-management.editor.delete-modal-title', 'Delete variable')}
          body={t('variables-management.editor.delete-modal-body', 'Are you sure you want to delete "{{name}}"?', {
            name: sceneVariable.state.name,
          })}
          confirmText={t('variables-management.editor.delete-modal-confirm', 'Delete')}
          onConfirm={() => {
            setShowDeleteModal(false);
            onDelete();
          }}
          onDismiss={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: theme.breakpoints.values.xl,
  }),
  folderField: css({
    maxWidth: theme.spacing(60),
  }),
});
