import { css } from '@emotion/css';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TextArea, Input, RadioButtonGroup, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { useLLMStream, StreamStatus } from 'app/features/dashboard/components/GenAI/hooks';
import { isLLMPluginEnabled, Message, Role, DEFAULT_LLM_MODEL, sanitizeReply } from 'app/features/dashboard/components/GenAI/utils';
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
  fieldsAutoFilled?: boolean;
  autofillDisabledThisSession?: boolean;
  aiLoading?: {
    title: boolean;
    description: boolean;
    path: boolean;
    comment: boolean;
    branch: boolean;
    magicSave: boolean;
  };
  setAiLoading?: React.Dispatch<React.SetStateAction<{
    title: boolean;
    description: boolean;
    path: boolean;
    comment: boolean;
    branch: boolean;
    magicSave: boolean;
  }>>;
}

export const DashboardEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, workflow, workflowOptions, isGitHub, isNew, resourceType, fieldsAutoFilled = false, autofillDisabledThisSession = false, aiLoading, setAiLoading }) => {
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
      magicSave: false,
    });

    const currentAiLoading = aiLoading || localAiLoading;
    const currentSetAiLoading = setAiLoading || setLocalAiLoading;

    // LLM state for different fields
    const [isLLMEnabled, setIsLLMEnabled] = useState(false);

    // Check if LLM is enabled
    useEffect(() => {
      isLLMPluginEnabled().then(setIsLLMEnabled);
    }, []);

    // LLM stream hooks for each field
    const commentLLMStream = useLLMStream({
      model: DEFAULT_LLM_MODEL,
      temperature: 0.8,
      onResponse: useCallback((response: string) => {
        const sanitized = sanitizeReply(response);
        setValue('comment', sanitized);
        currentSetAiLoading((prev: any) => ({ ...prev, comment: false }));
      }, [setValue, currentSetAiLoading])
    });

    const branchLLMStream = useLLMStream({
      model: DEFAULT_LLM_MODEL,
      temperature: 0.7,
      onResponse: useCallback((response: string) => {
        const sanitized = sanitizeReply(response);
        setValue('ref', sanitized);
        currentSetAiLoading((prev: any) => ({ ...prev, branch: false }));
      }, [setValue, currentSetAiLoading])
    });

    const pathLLMStream = useLLMStream({
      model: DEFAULT_LLM_MODEL,
      temperature: 0.6,
      onResponse: useCallback((response: string) => {
        const sanitized = sanitizeReply(response);
        setValue('path', sanitized);
        currentSetAiLoading((prev: any) => ({ ...prev, path: false }));
      }, [setValue, currentSetAiLoading])
    });

    // Typing effect function
    // const typeText = async (text: string, setValue: (value: string) => void, delay = 20) => {
    //   setValue(''); // Clear the field first
    //   for (let i = 0; i <= text.length; i++) {
    //     await new Promise(resolve => setTimeout(resolve, delay));
    //     setValue(text.slice(0, i));
    //   }
    // };

    // Helper function to create comment generation messages
    const getCommentMessages = useCallback((): Message[] => {
      const currentTitle = watch('title') || '';
      const currentDescription = watch('description') || '';
      
      return [
        {
          role: Role.system,
          content: `You are an expert in Git version control and ${resourceType} management. 
Your goal is to write a clear, descriptive Git commit message that explains the changes being made to this ${resourceType}.
The commit message should be professional, concise, and follow Git best practices.
It should be between 50-150 characters and explain what this change accomplishes.
Do not include quotes in your response.`
        },
        {
          role: Role.user,
          content: `Create a Git commit message for ${isNew ? 'adding a new' : 'updating an existing'} ${resourceType} with:
Title: "${currentTitle}"
Description: "${currentDescription}"
${isNew ? 'This is a new ' + resourceType + ' being added to the repository.' : 'This is an update to an existing ' + resourceType + '.'}`
        }
      ];
    }, [resourceType, isNew, watch]);

    // Helper function to create branch name generation messages
    const getBranchMessages = useCallback((): Message[] => {
      const currentTitle = watch('title') || '';
      
      return [
        {
          role: Role.system,
          content: `You are an expert in Git branch naming conventions.
Your goal is to create a descriptive branch name that follows Git best practices.
The branch name should be lowercase, use hyphens to separate words, and be concise but descriptive.
Common prefixes are: feature/, bugfix/, hotfix/, chore/, update/
The branch name should be between 15-50 characters.
Do not include quotes in your response.`
        },
        {
          role: Role.user,
          content: `Create a Git branch name for ${isNew ? 'adding' : 'updating'} a ${resourceType} titled: "${currentTitle}"`
        }
      ];
    }, [resourceType, isNew, watch]);

    // Helper function to create path generation messages
    const getPathMessages = useCallback((): Message[] => {
      const currentTitle = watch('title') || '';
      const currentYear = new Date().getFullYear();
      
      return [
        {
          role: Role.system,
          content: `You are an expert in file organization and naming conventions.
Your goal is to create a logical file path for storing a ${resourceType} in a repository.
The path should be organized, follow naming conventions, and include appropriate subdirectories.
For dashboards, use .json extension. Use lowercase with hyphens for separation.
Consider organizing by year, category, or purpose.
The path should be between 20-80 characters.
Do not include quotes in your response.`
        },
        {
          role: Role.user,
          content: `Create a file path for a ${resourceType} titled: "${currentTitle}" 
Current year: ${currentYear}
This should be a well-organized path within a Git repository.`
        }
      ];
    }, [resourceType, watch]);

    // Handlers for AI autofill
    const handleAIFillComment = async () => {
      if (!isLLMEnabled) {
        console.log('LLM is not enabled');
        return;
      }
      
      currentSetAiLoading((prev: any) => ({ ...prev, comment: true }));
      
      try {
        const messages = getCommentMessages();
        commentLLMStream.setMessages(messages);
      } catch (error) {
        console.error('AI autofill comment error:', error);
        currentSetAiLoading((prev: any) => ({ ...prev, comment: false }));
      }
    };

    const handleAIFillBranch = async () => {
      if (!isLLMEnabled) {
        console.log('LLM is not enabled');
        return;
      }
      
      currentSetAiLoading((prev: any) => ({ ...prev, branch: true }));
      
      try {
        const messages = getBranchMessages();
        branchLLMStream.setMessages(messages);
      } catch (error) {
        console.error('AI autofill branch error:', error);
        currentSetAiLoading((prev: any) => ({ ...prev, branch: false }));
      }
    };

    const handleAIFillPath = async () => {
      if (!isLLMEnabled) {
        console.log('LLM is not enabled');
        return;
      }
      
      currentSetAiLoading((prev: any) => ({ ...prev, path: true }));
      
      try {
        const messages = getPathMessages();
        pathLLMStream.setMessages(messages);
      } catch (error) {
        console.error('AI autofill path error:', error);
        currentSetAiLoading((prev: any) => ({ ...prev, path: false }));
      }
    };

    // Update loading states based on stream status
    useEffect(() => {
      if (commentLLMStream.streamStatus === StreamStatus.GENERATING) {
        currentSetAiLoading((prev: any) => ({ ...prev, comment: true }));
      } else if (commentLLMStream.streamStatus === StreamStatus.COMPLETED || commentLLMStream.error) {
        currentSetAiLoading((prev: any) => ({ ...prev, comment: false }));
      }
    }, [commentLLMStream.streamStatus, commentLLMStream.error, currentSetAiLoading]);

    useEffect(() => {
      if (branchLLMStream.streamStatus === StreamStatus.GENERATING) {
        currentSetAiLoading((prev: any) => ({ ...prev, branch: true }));
      } else if (branchLLMStream.streamStatus === StreamStatus.COMPLETED || branchLLMStream.error) {
        currentSetAiLoading((prev: any) => ({ ...prev, branch: false }));
      }
    }, [branchLLMStream.streamStatus, branchLLMStream.error, currentSetAiLoading]);

    useEffect(() => {
      if (pathLLMStream.streamStatus === StreamStatus.GENERATING) {
        currentSetAiLoading((prev: any) => ({ ...prev, path: true }));
      } else if (pathLLMStream.streamStatus === StreamStatus.COMPLETED || pathLLMStream.error) {
        currentSetAiLoading((prev: any) => ({ ...prev, path: false }));
      }
    }, [pathLLMStream.streamStatus, pathLLMStream.error, currentSetAiLoading]);

    // Don't show AI buttons if LLM is not enabled
    const showAIButtons = isLLMEnabled && !fieldsAutoFilled && !autofillDisabledThisSession;

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
              isNew && showAIButtons ? (
                <IconButton
                  name={currentAiLoading.path ? "spinner" : "ai-sparkle"}
                  tooltip={t(
                    'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path',
                    'AI autofill path'
                  )}
                  onClick={handleAIFillPath}
                  variant="secondary"
                  size="sm"
                  disabled={currentAiLoading.path}
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
              !readOnly && showAIButtons ? (
                <IconButton
                  name={currentAiLoading.comment ? "spinner" : "ai-sparkle"}
                  tooltip={t(
                    'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-comment',
                    'AI autofill comment'
                  )}
                  onClick={handleAIFillComment}
                  variant="secondary"
                  size="sm"
                  disabled={currentAiLoading.comment}
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
                    showAIButtons ? (
                      <IconButton
                        name={currentAiLoading.branch ? "spinner" : "ai-sparkle"}
                        tooltip={t(
                          'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-branch',
                          'AI autofill branch name'
                        )}
                        onClick={handleAIFillBranch}
                        variant="secondary"
                        size="sm"
                        disabled={currentAiLoading.branch}
                      />
                    ) : undefined
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
