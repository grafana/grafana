import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TextArea, Input, RadioButtonGroup } from '@grafana/ui';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

interface DashboardEditFormSharedFieldsProps {
  workflowOptions: Array<{ label: string; value: string }>;
  isNew?: boolean;
  readOnly?: boolean;
  workflow?: WorkflowOption;
  isGitHub?: boolean;
}

export const DashboardEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, workflow, workflowOptions, isGitHub, isNew }) => {
    const {
      control,
      register,
      formState: { errors },
    } = useFormContext();

    return (
      <>
        {/* Path */}
        <Field
          noMargin
          label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-path', 'Path')}
          description={t(
            'dashboard-scene.save-or-delete-provisioned-dashboard-form.description-inside-repository',
            'File path inside the repository (.json or .yaml)'
          )}
        >
          <Input id="dashboard-path" type="text" {...register('path')} readOnly={!isNew} />
        </Field>

        {/* Comment */}
        <Field noMargin label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-comment', 'Comment')}>
          <TextArea
            id="dashboard-comment"
            {...register('comment')}
            disabled={readOnly}
            placeholder={t(
              'dashboard-scene.save-or-delete-provisioned-dashboard-form.dashboard-comment-placeholder-describe-changes-optional',
              'Add a note to describe your changes (optional)'
            )}
            rows={5}
          />
        </Field>

        {/* Workflow */}
        {isGitHub && !readOnly && (
          <>
            <Field
              noMargin
              label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-workflow', 'Workflow')}
            >
              <Controller
                control={control}
                name="workflow"
                render={({ field: { ref: _, ...field } }) => (
                  <RadioButtonGroup id="dashboard-workflow" {...field} options={workflowOptions} />
                )}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                noMargin
                label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-branch', 'Branch')}
                description={t(
                  'dashboard-scene.save-or-delete-provisioned-dashboard-form.description-branch-name-in-git-hub',
                  'Branch name in GitHub'
                )}
                invalid={!!errors.ref}
                error={errors.ref && <BranchValidationError />}
              >
                <Input id="dashboard-branch" {...register('ref', { validate: validateBranchName })} />
              </Field>
            )}
          </>
        )}
      </>
    );
  }
);
