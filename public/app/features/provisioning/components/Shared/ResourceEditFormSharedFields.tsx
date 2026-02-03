import { skipToken } from '@reduxjs/toolkit/query/react';
import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, Field, Input, TextArea } from '@grafana/ui';
import { RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';
import { isGitProvider } from 'app/features/provisioning/utils/repositoryTypes';

import { useBranchDropdownOptions } from '../../hooks/useBranchDropdownOptions';
import { useLastBranch } from '../../hooks/useLastBranch';
import { usePRBranch } from '../../hooks/usePRBranch';

interface DashboardEditFormSharedFieldsProps {
  resourceType: 'dashboard' | 'folder';
  canPushToConfiguredBranch: boolean;
  isNew?: boolean;
  readOnly?: boolean;
  workflow?: WorkflowOption;
  repository?: RepositoryView;
  hidePath?: boolean;
}

export const ResourceEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, workflow, canPushToConfiguredBranch, repository, isNew, resourceType, hidePath = false }) => {
    const {
      control,
      register,
      formState: { errors },
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

    const branchOptions = useBranchDropdownOptions({
      repository,
      prBranch,
      lastBranch,
      branchData,
      canPushToConfiguredBranch,
      canPushToNonConfiguredBranch,
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
        {/* Path */}
        {!hidePath && (
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

        {/* Workflow */}
        {repository?.type && isGitProvider(repository.type) && !readOnly && (
          <>
            {(workflow === 'write' || workflow === 'branch') && (
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
                          onChange={(option) => onChange(option ? option.value : '')}
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
            )}
          </>
        )}
      </>
    );
  }
);
ResourceEditFormSharedFields.displayName = 'ResourceEditFormSharedFields';
