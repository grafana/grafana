import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslate } from '@grafana/i18n';
import { Field, Input, RadioButtonGroup } from '@grafana/ui';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

interface WorkflowFieldsProps {
  workflow?: WorkflowOption;
  workflowOptions: Array<{ label: string; value: string }>;
}

/**
 * @description
 * WorkflowFields component for the Save/Delete Provisioned Dashboard form.
 * This component renders a radio button group for selecting the workflow
 * (e.g., 'branch', 'write') and an input field for the branch name if the workflow is 'branch'.
 */

export const WorkflowFields = memo<WorkflowFieldsProps>(({ workflow, workflowOptions }) => {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext();
  const { t } = useTranslate();

  return (
    <>
      <Field noMargin label={t('dashboard-scene.save-provisioned-dashboard-form.label-workflow', 'Workflow')}>
        <Controller
          control={control}
          name="workflow"
          render={({ field: { ref: _, ...field } }) => (
            <RadioButtonGroup
              id="dashboard-workflow"
              {...field}
              options={workflowOptions}
              onChange={(value) => {
                console.log('🔧 Workflow changed to:', value);
                field.onChange(value);
              }}
            />
          )}
        />
      </Field>
      {workflow === 'branch' && (
        <Field
          noMargin
          label={t('dashboard-scene.save-provisioned-dashboard-form.label-branch', 'Branch')}
          description={t(
            'dashboard-scene.save-provisioned-dashboard-form.description-branch-name-in-git-hub',
            'Branch name in GitHub'
          )}
          invalid={!!errors.ref}
          error={errors.ref && <BranchValidationError />}
        >
          <Input id="dashboard-branch" {...register('ref', { validate: validateBranchName })} />
        </Field>
      )}
    </>
  );
});
