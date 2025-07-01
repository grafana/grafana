import { css } from '@emotion/css';
import { memo, useEffect, useRef, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TextArea, Input, RadioButtonGroup, useStyles2, useTheme2, Stack } from '@grafana/ui';
import { GenAIButton } from 'app/features/dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from 'app/features/dashboard/components/GenAI/tracking';
import { BranchValidationError } from 'app/features/provisioning/Shared/BranchValidationError';
import { WorkflowOption } from 'app/features/provisioning/types';
import { validateBranchName } from 'app/features/provisioning/utils/git';

import { DashboardChangeInfo } from '../../saving/shared';

import { AIContextProvider, useAIContext } from './AIContextProvider';

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
  changeInfo?: DashboardChangeInfo;
  setAiLoading: (updater: (prev: any) => any) => void;
  shouldAutoGenerateAll?: boolean;
}

const DashboardEditFormSharedFieldsInner = memo<DashboardEditFormSharedFieldsProps>(
  ({
    readOnly = false,
    workflowOptions,
    isGitHub,
    isNew,
    resourceType,
    fieldsAutoFilled = false,
    autofillDisabledThisSession = false,
    changeInfo,
    setAiLoading,
    shouldAutoGenerateAll,
  }) => {
    const {
      control,
      register,
      setValue,
      watch,
      formState: { errors },
    } = useFormContext();

    const workflow = watch('workflow');
    const currentTitle = watch('title') || '';
    const currentDescription = watch('description') || '';
    const comment = watch('comment');

    const pathText =
      resourceType === 'dashboard'
        ? 'File path inside the repository (.json or .yaml)'
        : 'Folder path inside the repository';

    // Get AI context
    const aiContext = useAIContext();

    // Create dashboard context for AI generation
    const getDashboardContext = useCallback(() => {
      return {
        title: currentTitle || 'Untitled Dashboard',
        tags: [], // Could be enhanced to get tags from dashboard state if available
        isNew: isNew || false,
        resourceType,
      };
    }, [currentTitle, isNew, resourceType]);

    // Don't show AI buttons if autofill is disabled
    const showAIButtons = !fieldsAutoFilled && !autofillDisabledThisSession;

    useEffect(() => {
      console.log('watched comment:', comment);
    }, [comment]);

    // Autofill handlers for each field
    // const handleAIFillPath = useCallback(() => {
    //   setAiLoading((prev) => ({ ...prev, path: true }));
    //   const dashboardContext = getDashboardContext();
    //   aiContext.pathLLMStream.setMessages(aiContext.getPathMessages(dashboardContext, currentTitle));
    // }, [aiContext, getDashboardContext, currentTitle, setAiLoading]);

    // const handleAIFillComment = useCallback(() => {
    //   setAiLoading((prev) => ({ ...prev, comment: true }));
    //   const dashboardContext = getDashboardContext();
    //   aiContext.commentLLMStream.setMessages(aiContext.getCommentMessages(dashboardContext, currentTitle, currentDescription, changeInfo));
    // }, [aiContext, getDashboardContext, currentTitle, currentDescription, changeInfo, setAiLoading]);

    // const handleAIFillBranch = useCallback(() => {
    //   setAiLoading((prev) => ({ ...prev, ref: true }));
    //   const dashboardContext = getDashboardContext();
    //   aiContext.branchLLMStream.setMessages(aiContext.getBranchMessages(dashboardContext, currentTitle));
    // }, [aiContext, getDashboardContext, currentTitle, setAiLoading]);

    // Per-field effect for autofill
    useEffect(() => {
      /**
       * We use a retry approach here because, due to React rendering and DOM timing,
       * the GenAIButton may not be present in the DOM on the first effect run.
       * This can happen especially when the drawer opens and the form is mounting.
       * We retry a few times (with a short delay) to ensure the button is available before clicking.
       * This avoids race conditions and ensures autofill is reliably triggered for all fields.
       */
      if (shouldAutoGenerateAll) {
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 120; // ms

        function tryClick(id: string) {
          const btn = document.getElementById(id)?.querySelector('button');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }

        function clickWithRetry(id: string) {
          if (tryClick(id)) {
            return;
          }
          if (retries < maxRetries) {
            retries++;
            setTimeout(() => clickWithRetry(id), retryDelay);
          } else {
            console.warn(`GenAIButton for ${id} not found after ${maxRetries} retries`);
          }
        }

        if (isNew) {
          clickWithRetry('path-ai-button-container');
        }
        clickWithRetry('comment-ai-button-container');
        if (workflow === 'branch') {
          clickWithRetry('ref-ai-button-container');
        }
      }
    }, [shouldAutoGenerateAll, isNew, workflow]);

    return (
      <>
        {/* Path */}
        <Field
          noMargin
          label={
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <span>{t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-path', 'Path')}</span>
              {isNew && showAIButtons && (
                <div id="path-ai-button-container">
                  <GenAIButton
                    tooltip={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path',
                      'AI autofill path'
                    )}
                    messages={aiContext.getPathMessages(getDashboardContext(), currentTitle)}
                    onGenerate={(response) => {
                      setValue('path', response, { shouldDirty: true });
                      setAiLoading((prev) => ({ ...prev, path: false }));
                    }}
                    eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                  />
                </div>
              )}
            </Stack>
          }
          description={t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-inside-repository',
            pathText
          )}
        >
          <Input
            id="dashboard-path"
            {...register('path', {
              required: t(
                'provisioned-resource-form.save-or-delete-resource-shared-fields.path-required',
                'Path is required'
              ),
            })}
          />
        </Field>

        {/* Comment */}
        <Field
          noMargin
          label={
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <span>
                {t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-comment', 'Comment')}
              </span>
              {!readOnly && showAIButtons && (
                <div id="comment-ai-button-container">
                  <GenAIButton
                    tooltip={t(
                      'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-comment',
                      'AI autofill comment'
                    )}
                    messages={aiContext.getCommentMessages(
                      getDashboardContext(),
                      currentTitle,
                      currentDescription,
                      changeInfo
                    )}
                    onGenerate={(response) => {
                      console.log('GenAIButton generated comment:', response);
                      setValue('comment', response, { shouldDirty: true, shouldTouch: true });
                      setAiLoading((prev) => ({ ...prev, comment: false }));
                    }}
                    eventTrackingSrc={EventTrackingSrc.dashboardChanges}
                  />
                </div>
              )}
            </Stack>
          }
          description={t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-git-commit-message',
            'Git commit message'
          )}
        >
          <Controller
            control={control}
            name="comment"
            render={({ field }) => (
              <TextAreaWithSuffix id="dashboard-comment" value={field.value || ''} onChange={field.onChange} />
            )}
          />
        </Field>

        {/* Workflow */}
        <Field
          noMargin
          label={t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-workflow', 'Workflow')}
        >
          <Controller
            control={control}
            name="workflow"
            render={({ field: { ref, value, onChange, ...field } }) => {
              return <RadioButtonGroup {...field} value={value} onChange={onChange} options={workflowOptions} />;
            }}
          />
        </Field>

        {/* Branch */}
        {workflow === 'branch' && (
          <Field
            noMargin
            label={
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <span>
                  {t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-branch', 'Branch')}
                </span>
                {showAIButtons && (
                  <div id="ref-ai-button-container">
                    <GenAIButton
                      tooltip={t(
                        'provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-branch',
                        'AI autofill branch'
                      )}
                      messages={aiContext.getBranchMessages(getDashboardContext(), currentTitle)}
                      onGenerate={(response) => {
                        setValue('ref', response, { shouldDirty: true });
                        setAiLoading((prev) => ({ ...prev, ref: false }));
                      }}
                      eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                    />
                  </div>
                )}
              </Stack>
            }
            description={t(
              'provisioned-resource-form.save-or-delete-resource-shared-fields.description-branch-name',
              'Branch name'
            )}
            invalid={!!errors.ref}
            error={errors.ref?.message?.toString()}
          >
            <>
              <Input
                id="dashboard-branch"
                {...register('ref', {
                  required: t(
                    'provisioned-resource-form.save-or-delete-resource-shared-fields.branch-required',
                    'Branch name is required'
                  ),
                  validate: (value) => {
                    if (isGitHub) {
                      return validateBranchName(value);
                    }
                    return true;
                  },
                })}
              />
              {isGitHub && errors.ref && <BranchValidationError />}
            </>
          </Field>
        )}
      </>
    );
  }
);

export const DashboardEditFormSharedFields = (props: DashboardEditFormSharedFieldsProps) => {
  const { setValue } = useFormContext();

  return (
    <AIContextProvider setValue={setValue}>
      <DashboardEditFormSharedFieldsInner {...props} />
    </AIContextProvider>
  );
};
