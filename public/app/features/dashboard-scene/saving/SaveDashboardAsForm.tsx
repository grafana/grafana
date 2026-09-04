import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { type UseFormSetValue, useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Input, Switch, Field, Label, TextArea, Stack, Alert, Box } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import {
  AnnoKeyIgnorePredefinedVariables,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
} from 'app/features/apiserver/types';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { getProvisionedMeta } from 'app/features/provisioning/components/utils/getProvisionedMeta';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import { type DashboardChangeInfo, NameAlreadyExistsError, SaveButton, isNameExistsError } from './shared';
import { useSaveDashboard } from './useSaveDashboard';

interface SaveDashboardAsFormDTO {
  firstName?: string;
  title: string;
  description: string;
  folder: { uid?: string; title?: string };
  copyTags: boolean;
}

export interface Props {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
  /** Prefer drawer.onClose so Save As folder/meta mutations are restored on cancel. */
  onCancel?: () => void;
  /** Carries title/description across a swap to another save form; omit outside the save drawer. */
  drawer?: SaveDashboardDrawer;
}

/**
 * Merges folder/provisioning overlay into dashboard meta for Save As without dropping
 * existing k8s identity fields (name, resourceVersion, etc.). Canceling Save As after a
 * folder change must leave the live scene able to save as an update.
 */
export function nextMetaAfterSaveAsFolderChange(
  currentMeta: DashboardMeta,
  folderUid: string | undefined,
  provisionedMeta: Awaited<ReturnType<typeof getProvisionedMeta>>
): DashboardMeta {
  const currentAnnotations = currentMeta.k8s?.annotations ?? {};
  const ignoreValue = currentAnnotations[AnnoKeyIgnorePredefinedVariables];

  // Drop the previous folder's manager annotations, and the source path with them: it records where
  // the file currently lives, so keeping it would pin generatePath() to the old folder and revert the
  // pick. Everything else is kept (including denylist).
  const droppedAnnotations = new Set<string>([AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath]);
  const preservedAnnotations = Object.fromEntries(
    Object.entries(currentAnnotations).filter(([key]) => !droppedAnnotations.has(key))
  );

  return {
    ...currentMeta,
    folderUid,
    k8s: {
      ...currentMeta.k8s,
      ...provisionedMeta.k8s,
      annotations: {
        ...preservedAnnotations,
        ...provisionedMeta.k8s?.annotations,
        ...(ignoreValue !== undefined ? { [AnnoKeyIgnorePredefinedVariables]: ignoreValue } : {}),
      },
    },
  };
}

export function SaveDashboardAsForm({ dashboard, changeInfo, onCancel, drawer }: Props) {
  const { changedSaveModel } = changeInfo;
  const draft = drawer?.saveFormDraft;

  const { register, handleSubmit, setValue, formState, getValues, watch, trigger } = useForm<SaveDashboardAsFormDTO>({
    mode: 'onBlur',
    defaultValues: {
      title: draft?.title ?? (changeInfo.isNew ? changedSaveModel.title! : `${changedSaveModel.title} Copy`),
      description: draft?.description ?? changedSaveModel.description ?? '',
      folder: {
        uid: dashboard.state.meta.folderUid,
        title: dashboard.state.meta.folderTitle,
      },
      // The Copy tags switch below is hidden for new dashboards, which have no source to copy
      // from: their tags are the user's own, so the default must keep them.
      copyTags: changeInfo.isNew,
    },
  });

  const { errors, isValid } = formState;
  const formValues = watch();

  const { state, onSaveDashboard } = useSaveDashboard(false);

  const [contentSent, setContentSent] = useState<{ title?: string; folderUid?: string }>({});

  const validationTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  // Validate title on form mount to catch invalid default values
  useEffect(() => {
    trigger('title');
  }, [trigger]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // Park what is typed as it changes rather than on unmount: React renders the form that takes
  // over before this one's cleanup runs, so an unmount write would reach it one swap too late
  useEffect(() => {
    if (drawer) {
      drawer.saveFormDraft = { title: formValues.title, description: formValues.description };
    }
  }, [drawer, formValues.title, formValues.description]);

  const folderSelectionIdRef = useRef(0);
  const onFolderChange = useCallback(
    async (uid: string | undefined, title: string | undefined) => {
      // Latest pick wins: an earlier, slower selection must not overwrite this one when it resolves
      const selectionId = ++folderSelectionIdRef.current;
      setValue('folder', { uid, title });
      let provisionedMeta: Awaited<ReturnType<typeof getProvisionedMeta>>;
      try {
        // The database escape hatch stays unmanaged whatever folder is picked
        provisionedMeta = drawer?.state.saveToDatabase ? {} : await getProvisionedMeta(uid);
      } catch {
        // Revert to what the scene meta still describes: a racing pick's value may never have reached it
        if (selectionId === folderSelectionIdRef.current) {
          setValue('folder', { uid: dashboard.state.meta.folderUid, title: dashboard.state.meta.folderTitle });
        }
        return;
      }
      if (selectionId !== folderSelectionIdRef.current) {
        return;
      }
      // folderTitle goes with folderUid, or the diff tab and a remounted picker keep naming the old folder
      dashboard.setState({
        meta: { ...nextMetaAfterSaveAsFolderChange(dashboard.state.meta, uid, provisionedMeta), folderTitle: title },
      });
      // Re-validate title when folder changes to check for duplicates in new folder
      trigger('title');
    },
    [dashboard, drawer, setValue, trigger]
  );

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setValue('title', e.target.value, { shouldDirty: true });
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      validationTimeoutRef.current = setTimeout(() => {
        trigger('title');
      }, 400);
    },
    [setValue, trigger]
  );

  const onSave = async (overwrite: boolean) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    const isTitleValid = await trigger('title');

    // This prevents the race between the new input and old validation state
    if (!isTitleValid) {
      return;
    }

    const data = getValues();

    // Only forward the denylist annotation. Spreading full getK8SMetadata() would include
    // name/resourceVersion and turn Save As into an update of the source dashboard.
    const ignoreValue =
      dashboard.state.meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables] ??
      dashboard.serializer.getK8SMetadata()?.annotations?.[AnnoKeyIgnorePredefinedVariables];

    const result = await onSaveDashboard(dashboard, {
      overwrite,
      folderUid: data.folder.uid,
      rawDashboardJSON: changedSaveModel,

      // save as config
      saveAsCopy: true,
      isNew: changeInfo.isNew,
      copyTags: data.copyTags,
      title: data.title,
      description: data.description,
      ...(ignoreValue !== undefined
        ? {
            k8s: {
              annotations: {
                [AnnoKeyIgnorePredefinedVariables]: ignoreValue,
              },
            },
          }
        : {}),
    });

    if (result.status === 'success') {
      dashboard.closeModal();
    } else {
      setContentSent({
        title: data.title,
        folderUid: data.folder.uid,
      });
    }
  };

  const cancelButton = (
    <Button variant="secondary" onClick={() => (onCancel ? onCancel() : dashboard.closeModal())} fill="outline">
      <Trans i18nKey="dashboard-scene.save-dashboard-as-form.cancel-button.cancel">Cancel</Trans>
    </Button>
  );

  const saveButton = (overwrite: boolean) => {
    return <SaveButton isValid={isValid} isLoading={state.loading} onSave={onSave} overwrite={overwrite} />;
  };
  function renderFooter(error?: Error) {
    const formValuesMatchContentSent =
      formValues.title.trim() === contentSent.title && formValues.folder.uid === contentSent.folderUid;
    if (isNameExistsError(error) && formValuesMatchContentSent) {
      return <NameAlreadyExistsError />;
    }
    return (
      <>
        {error && formValuesMatchContentSent && (
          <Alert
            title={t(
              'dashboard-scene.save-dashboard-as-form.render-footer.title-failed-to-save-dashboard',
              'Failed to save dashboard'
            )}
            severity="error"
          >
            {error.message && <p>{error.message}</p>}
          </Alert>
        )}
        <Stack alignItems="center">
          {cancelButton}
          {saveButton(false)}
        </Stack>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit(() => onSave(false))}>
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={<TitleFieldLabel onChange={setValue} />}
          invalid={!!errors.title}
          error={errors.title?.message}
        >
          <Input
            {...register('title', {
              required: t('dashboard-scene.save-dashboard-as-form.required', 'Required'),
              validate: validateDashboardName,
              onChange: handleTitleChange,
            })}
            aria-label={t(
              'dashboard-scene.save-dashboard-as-form.aria-label-save-dashboard-title-field',
              'Save dashboard title field'
            )}
            data-testid={selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput}
          />
        </Field>
        <Field
          noMargin
          label={<DescriptionLabel onChange={setValue} />}
          invalid={!!errors.description}
          error={errors.description?.message}
        >
          <TextArea
            {...register('description', { required: false })}
            aria-label={t(
              'dashboard-scene.save-dashboard-as-form.aria-label-save-dashboard-description-field',
              'Save dashboard description field'
            )}
            autoFocus
          />
        </Field>

        <Field noMargin label={t('dashboard-scene.save-dashboard-as-form.label-folder', 'Folder')}>
          <FolderPicker onChange={onFolderChange} value={formValues.folder?.uid} />
        </Field>
        {!changeInfo.isNew && (
          <Field noMargin label={t('dashboard-scene.save-dashboard-as-form.label-copy-tags', 'Copy tags')}>
            <Switch {...register('copyTags')} />
          </Field>
        )}
        <Box paddingTop={2}>{renderFooter(state.error)}</Box>
      </Stack>
    </form>
  );
}

interface TitleLabelProps {
  onChange: UseFormSetValue<SaveDashboardAsFormDTO>;
}

function TitleFieldLabel(props: TitleLabelProps) {
  return (
    <Stack justifyContent="space-between">
      <Label htmlFor="description">
        <Trans i18nKey="dashboard-scene.title-field-label.title">Title</Trans>
      </Label>
    </Stack>
  );
}

interface DescriptionLabelProps {
  onChange: UseFormSetValue<SaveDashboardAsFormDTO>;
}

function DescriptionLabel(props: DescriptionLabelProps) {
  return (
    <Stack justifyContent="space-between">
      <Label htmlFor="description">
        <Trans i18nKey="dashboard-scene.description-label.description">Description</Trans>
      </Label>
    </Stack>
  );
}

async function validateDashboardName(title: string, formValues: SaveDashboardAsFormDTO) {
  if (title === formValues.folder.title?.trim()) {
    return 'Dashboard name cannot be the same as folder name';
  }

  try {
    await validationSrv.validateNewDashboardName(formValues.folder.uid ?? 'general', title);
    return true;
  } catch (e) {
    return e instanceof Error ? e.message : 'Dashboard name is invalid';
  }
}
