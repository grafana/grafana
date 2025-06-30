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
}

const DashboardEditFormSharedFieldsInner = memo<DashboardEditFormSharedFieldsProps>(
  ({ readOnly = false, workflowOptions, isGitHub, isNew, resourceType, fieldsAutoFilled = false, autofillDisabledThisSession = false, changeInfo }) => {
    const {
      control,
      register,
      setValue,
      watch,
      formState: { errors },
    } = useFormContext();

    const workflow = watch('workflow');
    const comment = watch('comment');
    const currentTitle = watch('title') || '';
    const currentDescription = watch('description') || '';

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

    return (
      <>
        {/* Path */}
        <Field
          noMargin
          label={
            <Stack direction="row" alignItems="center" gap={1}>
              <span>{t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-path', 'Path')}</span>
              {isNew && showAIButtons && (
                <GenAIButton
                  text={t('dashboard-scene.save-provisioned-dashboard-form.auto-generate', 'Auto-generate')}
                  tooltip={t('provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-path', 'AI autofill path')}
                  messages={aiContext.getPathMessages(getDashboardContext(), currentTitle)}
                  onGenerate={(response) => setValue('path', response)}
                  eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                />
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
            <Stack direction="row" alignItems="center" gap={1}>
              <span>{t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-comment', 'Comment')}</span>
              {!readOnly && showAIButtons && (
                <GenAIButton
                  text={t('dashboard-scene.save-provisioned-dashboard-form.auto-generate', 'Auto-generate')}
                  tooltip={t('provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-comment', 'AI autofill comment')}
                  messages={aiContext.getCommentMessages(getDashboardContext(), currentTitle, currentDescription, changeInfo)}
                  onGenerate={(response) => setValue('comment', response)}
                  eventTrackingSrc={EventTrackingSrc.dashboardChanges}
                />
              )}
            </Stack>
          }
          description={t(
            'provisioned-resource-form.save-or-delete-resource-shared-fields.description-git-commit-message',
            'Git commit message'
          )}
        >
          <TextAreaWithSuffix
            id="dashboard-comment"
            value={comment || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue('comment', e.target.value)}
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
              return (
                <RadioButtonGroup
                  {...field}
                  value={value}
                  onChange={onChange}
                  options={workflowOptions}
                />
              );
            }}
          />
        </Field>

        {/* Branch */}
        {workflow === 'branch' && (
          <Field
            noMargin
            label={
              <Stack direction="row" alignItems="center" gap={1}>
                <span>{t('provisioned-resource-form.save-or-delete-resource-shared-fields.label-branch', 'Branch')}</span>
                {showAIButtons && (
                  <GenAIButton
                    text={t('dashboard-scene.save-provisioned-dashboard-form.auto-generate', 'Auto-generate')}
                    tooltip={t('provisioned-resource-form.save-or-delete-resource-shared-fields.ai-fill-branch', 'AI autofill branch')}
                    messages={aiContext.getBranchMessages(getDashboardContext(), currentTitle)}
                    onGenerate={(response) => setValue('ref', response)}
                    eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                  />
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

export const DashboardEditFormSharedFields = memo<DashboardEditFormSharedFieldsProps>(
  (props) => {
    const { setValue } = useFormContext();
    
    return (
      <AIContextProvider 
        setValue={setValue}
      >
        <DashboardEditFormSharedFieldsInner {...props} />
      </AIContextProvider>
    );
  }
);
