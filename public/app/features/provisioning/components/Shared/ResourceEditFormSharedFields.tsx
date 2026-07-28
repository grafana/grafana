import { skipToken } from '@reduxjs/toolkit/query/react';
import { memo, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, Field, Input, TextArea } from '@grafana/ui';
import {
  type RepositoryView,
  useGetRepositoryRefsQuery,
  useLazyGetRepositoryFilesWithPathQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { validateBranchName } from 'app/features/provisioning/utils/git';
import { isGitProvider } from 'app/features/provisioning/utils/repositoryTypes';

import { useBranchDropdownOptions } from '../../hooks/useBranchDropdownOptions';
import { useGetRepositoryFolders } from '../../hooks/useGetRepositoryFolders';
import { useLastBranch } from '../../hooks/useLastBranch';
import { usePRBranch } from '../../hooks/usePRBranch';
import { type BaseProvisionedFormData } from '../../types/form';
import { type ResourceKindKey } from '../../utils/resourceKinds';
import { joinPath, splitPath } from '../utils/path';

type SharedFieldName = 'path' | 'comment';

interface DashboardEditFormSharedFieldsProps {
  resourceType: ResourceKindKey;
  canPushToConfiguredBranch: boolean;
  isNew?: boolean;
  readOnly?: boolean;
  repository?: RepositoryView;
  hiddenFields?: SharedFieldName[];
  allowPathEdit?: boolean;
  /** When true, the comment field renders read-only (template enforcement). */
  lockComment?: boolean;
  /** The resolved, read-only commit message to display when `lockComment` is true. */
  commitMessage?: string;
  /** When true, the branch field renders read-only (template enforcement). */
  lockBranch?: boolean;
}

export const ResourceEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({
    readOnly = false,
    canPushToConfiguredBranch,
    repository,
    isNew,
    resourceType,
    hiddenFields,
    allowPathEdit,
    lockComment = false,
    commitMessage,
    lockBranch = false,
  }) => {
    const {
      control,
      register,
      formState: { errors },
      setValue,
      watch,
    } = useFormContext<BaseProvisionedFormData>();

    const [checkFile] = useLazyGetRepositoryFilesWithPathQuery();

    const validatePath = useCallback(
      async (path: string) => {
        if (!path || !repository?.name) {
          return true;
        }
        const ref = watch('ref');
        try {
          await checkFile({ name: repository.name, path, ref: ref || undefined }).unwrap();
          return t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.path-exists',
            'A file with this name already exists at this path'
          );
        } catch {
          return true;
        }
      },
      [checkFile, repository?.name, watch]
    );

    // New resources with an editable path (dashboards, playlists) get a path-exists check so a
    // duplicate path is caught before submit rather than only by the API.
    const shouldValidatePath = isNew && (resourceType === 'dashboard' || resourceType === 'playlist');

    const canPushToNonConfiguredBranch = repository?.workflows?.includes('branch');
    const canOnlyPushToConfiguredBranch = canPushToConfiguredBranch && !canPushToNonConfiguredBranch;

    const {
      data: branchData,
      isLoading: branchLoading,
      error: branchError,
    } = useGetRepositoryRefsQuery(
      !repository?.name || !isGitProvider(repository.type) ? skipToken : { name: repository.name }
    );

    const { getLastBranch } = useLastBranch();
    const prBranch = usePRBranch();
    const lastBranch = getLastBranch(repository?.name);
    const selectedBranch = watch('ref');

    const branchOptions = useBranchDropdownOptions({
      repository,
      prBranch,
      lastBranch,
      selectedBranch,
      branchData,
      canPushToConfiguredBranch,
      canPushToNonConfiguredBranch,
    });

    const showFolderFilename = (isNew || allowPathEdit) && resourceType === 'dashboard';

    const { options: folderOptions, loading: isFoldersLoading } = useGetRepositoryFolders({
      repositoryName: showFolderFilename ? repository?.name : undefined,
      ref: selectedBranch || undefined,
    });

    const pathText =
      resourceType === 'folder'
        ? t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-folder-path',
            'Folder path inside the repository'
          )
        : t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-file-path',
            'File path inside the repository (.json or .yaml)'
          );

    return (
      <>
        {/* Workflow */}
        {repository?.type && isGitProvider(repository.type) && !readOnly && (
          <>
            <Field
              disabled={canOnlyPushToConfiguredBranch || lockBranch}
              htmlFor="provisioned-ref"
              noMargin
              label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-branch', 'Branch')}
              description={
                lockBranch
                  ? t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.description-branch-enforced',
                      "The branch name is set by the repository's branch naming template and can't be changed"
                    )
                  : canOnlyPushToConfiguredBranch
                    ? t(
                        'provisioned-resource-form.save-or-delete-resource-shared-fields.description-branch-restricted',
                        'This repository is restricted to the configured branch only'
                      )
                    : t(
                        'provisioned-resource-form.save-or-delete-resource-shared-fields.description-branch',
                        'Select an existing branch or enter a new branch name to create a branch'
                      )
              }
              invalid={Boolean(errors.ref || branchError)}
              error={
                errors.ref ? (
                  <BranchValidationError />
                ) : branchError ? (
                  t('provisioning.config-form.error-fetch-branches', 'Failed to fetch branches')
                ) : undefined
              }
            >
              <Controller
                name="ref"
                control={control}
                rules={{
                  validate: validateBranchName,
                  // When the branch changes, re-run path validation: a file may exist on one
                  // branch but not another, so the previous result is stale on the new ref.
                  deps: shouldValidatePath ? ['path'] : undefined,
                }}
                render={({ field: { ref, onChange, ...field } }) => (
                  <>
                    {canOnlyPushToConfiguredBranch || lockBranch ? (
                      // If only allow to push to configured branch, show a read-only input with that branch
                      <Input {...field} id="provisioned-ref" readOnly />
                    ) : (
                      <Combobox
                        {...field}
                        invalid={!!errors.ref}
                        id="provisioned-ref"
                        onChange={(option) => {
                          const selectedBranch = option ? option.value : '';
                          onChange(selectedBranch);
                          setValue('workflow', selectedBranch === repository.branch ? 'write' : 'branch');
                        }}
                        placeholder={t(
                          'provisioned-resource-form.save-or-delete-resource-shared-fields.placeholder-branch',
                          'Select or enter branch name'
                        )}
                        options={branchOptions}
                        loading={branchLoading}
                        createCustomValue
                        isClearable
                        customValueDescription={t(
                          'provisioned-resource-form.save-or-delete-resource-shared-fields.custom-value-description',
                          'Press Enter to create new branch'
                        )}
                        prefixIcon="code-branch"
                      />
                    )}
                  </>
                )}
              />
            </Field>
          </>
        )}

        {/* Path — split into folder + filename for new dashboards */}
        {!hiddenFields?.includes('path') && showFolderFilename && (
          <Controller
            name="path"
            control={control}
            rules={shouldValidatePath ? { validate: validatePath } : undefined}
            render={({ field: { ref: _ref, onChange, value } }) => {
              const { directory: dir, filename: file } = splitPath(value || '');
              return (
                <>
                  <Field
                    noMargin
                    htmlFor="folder-path"
                    label={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.label-repository-folder',
                      'Repository folder'
                    )}
                    description={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.description-folder',
                      'Folder inside the repository. Leave empty for the repository root.'
                    )}
                  >
                    <Combobox
                      id="folder-path"
                      value={dir}
                      onChange={(option) => {
                        setValue('path', joinPath(option?.value ?? '', file), {
                          shouldDirty: !isNew,
                          shouldValidate: true,
                        });
                      }}
                      options={folderOptions}
                      loading={isFoldersLoading}
                      createCustomValue
                      isClearable
                      placeholder={t(
                        'provisioned-resource-form.save-or-delete-resource-shared-fields.placeholder-folder',
                        'Select or enter folder path'
                      )}
                    />
                  </Field>
                  <Field
                    noMargin
                    htmlFor="dashboard-filename"
                    label={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.label-filename',
                      'Filename'
                    )}
                    description={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.description-filename',
                      'File name for the dashboard (.json or .yaml)'
                    )}
                    invalid={!!errors.path}
                    error={errors?.path?.message}
                  >
                    <Input
                      id="dashboard-filename"
                      type="text"
                      value={file}
                      onChange={(e) => {
                        onChange(joinPath(dir, e.currentTarget.value));
                      }}
                    />
                  </Field>
                </>
              );
            }}
          />
        )}

        {/* Path — single field (read-only for existing resources, editable + validated when new) */}
        {!hiddenFields?.includes('path') && !showFolderFilename && (
          <Field
            noMargin
            label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-path', 'Path')}
            description={t(
              'provisioned-resource-form.save-or-delete-resource-shared-fields.description-inside-repository',
              pathText
            )}
            invalid={!!errors.path}
            error={errors?.path?.message}
          >
            <Input
              id="dashboard-path"
              type="text"
              {...register('path', shouldValidatePath ? { validate: validatePath } : undefined)}
              readOnly={!isNew}
            />
          </Field>
        )}

        {/* Comment */}
        {!hiddenFields?.includes('comment') && (
          <Field
            noMargin
            label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-comment', 'Comment')}
          >
            {lockComment ? (
              <TextArea
                id="provisioned-resource-form-comment"
                value={commitMessage ?? ''}
                readOnly
                disabled={readOnly}
                rows={5}
              />
            ) : (
              <TextArea
                id="provisioned-resource-form-comment"
                {...register('comment')}
                disabled={readOnly}
                placeholder={t(
                  'provisioned-resource-form.save-or-delete-resource-shared-fields.comment-placeholder-describe-changes-optional',
                  'Add a note to describe your changes (optional)'
                )}
                rows={5}
              />
            )}
          </Field>
        )}
      </>
    );
  }
);
ResourceEditFormSharedFields.displayName = 'ResourceEditFormSharedFields';
