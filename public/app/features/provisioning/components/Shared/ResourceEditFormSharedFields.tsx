import { skipToken } from '@reduxjs/toolkit/query/react';
import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, Field, Input, TextArea } from '@grafana/ui';
import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { validateBranchName } from 'app/features/provisioning/utils/git';
import { isGitProvider } from 'app/features/provisioning/utils/repositoryTypes';

import { useBranchDropdownOptions } from '../../hooks/useBranchDropdownOptions';
import { useGetRepositoryFolders } from '../../hooks/useGetRepositoryFolders';
import { useLastBranch } from '../../hooks/useLastBranch';
import { usePRBranch } from '../../hooks/usePRBranch';
import { joinPath, splitPath } from '../utils/path';

type SharedFieldName = 'path' | 'comment';

interface DashboardEditFormSharedFieldsProps {
  resourceType: 'dashboard' | 'folder';
  canPushToConfiguredBranch: boolean;
  isNew?: boolean;
  readOnly?: boolean;
  repository?: RepositoryView;
  hiddenFields?: SharedFieldName[];
}

export const ResourceEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, canPushToConfiguredBranch, repository, isNew, resourceType, hiddenFields }) => {
    const {
      control,
      register,
      formState: { errors },
      setValue,
      watch,
    } = useFormContext();

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

    const showFolderFilename = isNew && resourceType === 'dashboard';

    const { options: folderOptions, loading: isFoldersLoading } = useGetRepositoryFolders({
      repositoryName: showFolderFilename ? repository?.name : undefined,
      ref: selectedBranch || undefined,
    });

    const pathText =
      resourceType === 'dashboard'
        ? t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-file-path',
            'File path inside the repository (.json or .yaml)'
          )
        : t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-folder-path',
            'Folder path inside the repository'
          );

    return (
      <>
        {/* Workflow */}
        {repository?.type && isGitProvider(repository.type) && !readOnly && (
          <>
            <Field
              disabled={canOnlyPushToConfiguredBranch}
              htmlFor="provisioned-ref"
              noMargin
              label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-branch', 'Branch')}
              description={
                canOnlyPushToConfiguredBranch
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
                rules={{ validate: validateBranchName }}
                render={({ field: { ref, onChange, ...field } }) => (
                  <>
                    {canOnlyPushToConfiguredBranch ? (
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
            render={({ field: { ref, onChange, value } }) => {
              const { directory: dir, filename: file } = splitPath(value || '');
              return (
                <>
                  <Field
                    noMargin
                    htmlFor="folder-path"
                    label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-folder', 'Folder')}
                    description={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.description-folder',
                      'Folder inside the repository. Leave empty for the repository root.'
                    )}
                  >
                    <Combobox
                      id="folder-path"
                      value={dir}
                      onChange={(option) => {
                        // setValue (not onChange) so folder picks don't dirty the path field,
                        // preserving title→filename auto-sync until the filename is edited.
                        setValue('path', joinPath(option?.value ?? '', file));
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

        {/* Path — single read-only field for existing resources */}
        {!hiddenFields?.includes('path') && !showFolderFilename && (
          <Field
            noMargin
            label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-path', 'Path')}
            description={t(
              'provisioned-resource-form.save-or-delete-resource-shared-fields.description-inside-repository',
              pathText
            )}
          >
            <Input id="dashboard-path" type="text" {...register('path')} readOnly={!isNew} />
          </Field>
        )}

        {/* Comment */}
        {!hiddenFields?.includes('comment') && (
          <Field
            noMargin
            label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-comment', 'Comment')}
          >
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
          </Field>
        )}
      </>
    );
  }
);
ResourceEditFormSharedFields.displayName = 'ResourceEditFormSharedFields';
