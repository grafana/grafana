import { css } from '@emotion/css';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TextArea, Input, RadioButtonGroup, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

// Custom TextArea with suffix support
interface TextAreaWithSuffixProps extends React.ComponentProps<typeof TextArea> {
  suffix?: React.ReactNode;
}

const TextAreaWithSuffix = ({ suffix, value, ...textAreaProps }: TextAreaWithSuffixProps) => {
  const theme = useTheme2();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const styles = useStyles2(() => ({
    wrapper: css({
      position: 'relative',
      display: 'flex',
    }),
    textArea: css({
      paddingRight: suffix ? theme.spacing(5) : undefined,
      resize: 'none',
      overflow: 'hidden',
      minHeight: theme.spacing(5), // Minimum height
    }),
    suffix: css({
      position: 'absolute',
      top: theme.spacing(1),
      right: theme.spacing(1),
      zIndex: 1,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      pointerEvents: 'auto',
    }),
  }));

  // Auto-resize function
  const autoResize = useCallback(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      // Reset height to auto to get the actual scrollHeight
      textArea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textArea.style.height = `${Math.max(textArea.scrollHeight, parseInt(theme.spacing(5), 10))}px`;
    }
  }, [theme]);

  // Auto-resize on value change (including during typing effect)
  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  // Auto-resize on initial mount
  useEffect(() => {
    autoResize();
  }, [autoResize]);

  return (
    <div className={styles.wrapper}>
      <TextArea 
        {...textAreaProps} 
        ref={textAreaRef}
        value={value}
        className={styles.textArea}
        onInput={autoResize} // Also resize on manual input
      />
      {suffix && <div className={styles.suffix}>{suffix}</div>}
    </div>
  );
};

interface DashboardEditFormSharedFieldsProps {
  resourceType: 'dashboard' | 'folder';
  workflowOptions: Array<{ label: string; value: string }>;
  isNew?: boolean;
  readOnly?: boolean;
  workflow?: WorkflowOption;
  isGitHub?: boolean;
  aiLoading?: {
    title: boolean;
    description: boolean;
    path: boolean;
    comment: boolean;
    branch: boolean;
    all: boolean;
    magicSave: boolean;
  };
  setAiLoading?: React.Dispatch<React.SetStateAction<{
    title: boolean;
    description: boolean;
    path: boolean;
    comment: boolean;
    branch: boolean;
    all: boolean;
    magicSave: boolean;
  }>>;
}

export const DashboardEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, workflow, workflowOptions, isGitHub, isNew, resourceType, aiLoading, setAiLoading }) => {
    const {
      control,
      register,
      setValue,
      watch,
      formState: { errors },
    } = useFormContext();

    const comment = watch('comment');

    const pathText =
      resourceType === 'dashboard'
        ? 'File path inside the repository (.json or .yaml)'
        : 'Folder path inside the repository';

    // Use external loading states if provided, otherwise create local ones
    const [localAiLoading, setLocalAiLoading] = useState({
      title: false,
      description: false,
      path: false,
      comment: false,
      branch: false,
      all: false,
      magicSave: false,
    });

    const currentAiLoading = aiLoading || localAiLoading;
    const currentSetAiLoading = setAiLoading || setLocalAiLoading;

    // Typing effect function
    const typeText = async (text: string, setValue: (value: string) => void, delay = 20) => {
      setValue(''); // Clear the field first
      for (let i = 0; i <= text.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        setValue(text.slice(0, i));
      }
    };

    // Sample AI generated content
    const generateSampleContent = () => ({
      path: `${resourceType}s/${new Date().getFullYear()}/optimized-${resourceType}-${Date.now()}.json`,
      comment: `Add enhanced ${resourceType} with improved performance monitoring and analytics capabilities. This update includes new visualizations and better data organization.`,
      branch: `feature/enhanced-${resourceType}-${new Date().toISOString().slice(0, 7)}`,
    });

    // Handlers for AI autofill
    const handleAIFillComment = async () => {
      currentSetAiLoading((prev: any) => ({ ...prev, comment: true }));
      
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const content = generateSampleContent();
        await typeText(content.comment, (value) => setValue('comment', value), 40);
      } catch (error) {
        console.error('AI autofill comment error:', error);
      } finally {
        currentSetAiLoading((prev: any) => ({ ...prev, comment: false }));
      }
    };

    const handleAIFillBranch = async () => {
      currentSetAiLoading((prev: any) => ({ ...prev, branch: true }));
      
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        const content = generateSampleContent();
        await typeText(content.branch, (value) => setValue('ref', value));
      } catch (error) {
        console.error('AI autofill branch error:', error);
      } finally {
        currentSetAiLoading((prev: any) => ({ ...prev, branch: false }));
      }
    };

    const handleAIFillPath = async () => {
      currentSetAiLoading((prev: any) => ({ ...prev, path: true }));
      
      try {
        await new Promise(resolve => setTimeout(resolve, 900));
        const content = generateSampleContent();
        await typeText(content.path, (value) => setValue('path', value));
      } catch (error) {
        console.error('AI autofill path error:', error);
      } finally {
        currentSetAiLoading((prev: any) => ({ ...prev, path: false }));
      }
    };

    return (
      <>
        {/* Path */}
        <Field
          noMargin
          label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-path', 'Path')}
          description={t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-inside-repository',
            pathText
          )}
        >
          <Input 
            id="dashboard-path" 
            type="text" 
            {...register('path')} 
            readOnly={!isNew}
            suffix={
              isNew ? (
                <IconButton
                  name={currentAiLoading.path ? "spinner" : "ai-sparkle"}
                  tooltip={t(
                    'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path',
                    'AI autofill path'
                  )}
                  onClick={handleAIFillPath}
                  variant="secondary"
                  size="sm"
                  disabled={currentAiLoading.path || currentAiLoading.all}
                />
              ) : undefined
            }
          />
        </Field>

        {/* Comment */}
        <Field
          noMargin
          label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-comment', 'Comment')}
        >
          <TextAreaWithSuffix
            id="provisioned-resource-form-comment"
            value={comment || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue('comment', e.target.value)}
            disabled={readOnly}
            placeholder={t(
              'provisioned-resource-form.save-or-delete-resource-shared-fields.comment-placeholder-describe-changes-optional',
              'Add a note to describe your changes (optional)'
            )}
            suffix={
              !readOnly ? (
                <IconButton
                  name={currentAiLoading.comment ? "spinner" : "ai-sparkle"}
                  tooltip={t(
                    'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-comment',
                    'AI autofill comment'
                  )}
                  onClick={handleAIFillComment}
                  variant="secondary"
                  size="sm"
                  disabled={currentAiLoading.comment || currentAiLoading.all}
                />
              ) : undefined
            }
          />
        </Field>

        {/* Workflow */}
        {isGitHub && !readOnly && (
          <>
            <Field
              noMargin
              label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-workflow', 'Workflow')}
            >
              <Controller
                control={control}
                name="workflow"
                render={({ field: { ref: _, ...field } }) => (
                  <RadioButtonGroup id="provisioned-resource-form-workflow" {...field} options={workflowOptions} />
                )}
              />
            </Field>
            {workflow === 'branch' && (
              <Field
                noMargin
                label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-branch', 'Branch')}
                description={t(
                  'provisioned-resource-form.save-or-delete-resource-shared-fields.description-branch-name-in-git-hub',
                  'Branch name in GitHub'
                )}
                invalid={!!errors.ref}
                error={errors.ref && <BranchValidationError />}
              >
                <Input 
                  id="provisioned-resource-form-branch" 
                  {...register('ref', { validate: validateBranchName })}
                  suffix={
                    <IconButton
                      name={currentAiLoading.branch ? "spinner" : "ai-sparkle"}
                      tooltip={t(
                        'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-branch',
                        'AI autofill branch name'
                      )}
                      onClick={handleAIFillBranch}
                      variant="secondary"
                      size="sm"
                      disabled={currentAiLoading.branch || currentAiLoading.all}
                    />
                  }
                />
              </Field>
            )}
          </>
        )}
      </>
    );
  }
);
