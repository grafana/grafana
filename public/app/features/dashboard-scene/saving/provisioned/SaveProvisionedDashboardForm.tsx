import { css } from '@emotion/css';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Controller, useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Alert, Button, Field, Input, Stack, TextArea, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import kbn from 'app/core/utils/kbn';
import { Resource } from 'app/features/apiserver/types';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

import { DashboardEditFormSharedFields } from '../../components/Provisioned/DashboardEditFormSharedFields';
import { getDashboardUrl } from '../../utils/getDashboardUrl';
import { useProvisionedRequestHandler } from '../../utils/useProvisionedRequestHandler';
import { SaveDashboardFormCommonOptions } from '../SaveDashboardForm';
import { ProvisionedDashboardFormData } from '../shared';

import { SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';
import { getProvisionedMeta } from './utils/getProvisionedMeta';

export interface Props extends SaveProvisionedDashboardProps {
  isNew: boolean;
  defaultValues: ProvisionedDashboardFormData;
  isGitHub: boolean;
  loadedFromRef?: string;
  workflowOptions: Array<{ label: string; value: string }>;
  readOnly: boolean;
}

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

export function SaveProvisionedDashboardForm({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  loadedFromRef,
  isGitHub,
  workflowOptions,
  readOnly,
}: Props) {
  const navigate = useNavigate();
  const appEvents = getAppEvents();
  const { isDirty, editPanel: panelEditor } = dashboard.useState();

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isNew ? undefined : defaultValues.path);

  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues });
  const { handleSubmit, watch, control, reset, register, setValue } = methods;
  const [workflow, description] = watch(['workflow', 'description']);

  // AI loading states
  const [aiLoading, setAiLoading] = useState({
    title: false,
    description: false,
    path: false,
    comment: false,
    branch: false,
    all: false,
    magicSave: false,
  });



  // Update the form if default values change
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

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
    title: `${dashboard.state.title || 'Dashboard'} - Enhanced Analytics`,
    description: `This dashboard provides comprehensive monitoring and analytics for ${dashboard.state.title || 'your system'}. It includes real-time metrics, performance indicators, and actionable insights to help you monitor system health, track key performance metrics, and identify potential issues before they impact your operations.`,
  });

  const onRequestError = (error: unknown) => {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: [t('dashboard-scene.save-provisioned-dashboard-form.api-error', 'Error saving dashboard'), error],
    });
  };

  const onWriteSuccess = () => {
    panelEditor?.onDiscard();
    drawer.onClose();
    locationService.partial({
      viewPanel: null,
      editPanel: null,
    });
  };

  const onNewDashboardSuccess = (upsert: Resource<Dashboard>) => {
    panelEditor?.onDiscard();
    drawer.onClose();
    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: upsert.metadata.name,
        slug: kbn.slugifyForUrl(upsert.spec.title ?? ''),
        currentQueryParams: window.location.search,
      })
    );

    navigate(url);
  };

  const onBranchSuccess = (ref: string, path: string) => {
    panelEditor?.onDiscard();
    drawer.onClose();
    navigate(`${PROVISIONING_URL}/${defaultValues.repo}/dashboard/preview/${path}?ref=${ref}`);
  };

  useProvisionedRequestHandler({
    dashboard,
    request,
    workflow,
    handlers: {
      onBranchSuccess: ({ ref, path }) => onBranchSuccess(ref, path),
      onWriteSuccess,
      onNewDashboardSuccess,
      onError: onRequestError,
    },
    isNew,
  });

  // AI handler functions with loading and typing effects
  const handleAIFillTitle = async () => {
    setAiLoading(prev => ({ ...prev, title: true }));
    
    try {
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const content = generateSampleContent();
      await typeText(content.title, (value) => setValue('title', value));
    } catch (error) {
      console.error('AI autofill title error:', error);
    } finally {
      setAiLoading(prev => ({ ...prev, title: false }));
    }
  };

  const handleAIFillDescription = async () => {
    setAiLoading(prev => ({ ...prev, description: true }));
    
    try {
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const content = generateSampleContent();
      await typeText(content.description, (value) => setValue('description', value), 30);
    } catch (error) {
      console.error('AI autofill description error:', error);
    } finally {
      setAiLoading(prev => ({ ...prev, description: false }));
    }
  };

  const handleAIFillAllInternal = async (isParallel = false) => {
    setAiLoading(prev => ({ ...prev, all: true }));
    
    try {
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const content = generateSampleContent();
      
      // Generate shared fields content
      const sharedContent = {
        path: `dashboards/${new Date().getFullYear()}/optimized-dashboard-${Date.now()}.json`,
        comment: `Add enhanced dashboard with improved performance monitoring and analytics capabilities. This update includes new visualizations and better data organization.`,
        branch: `feature/enhanced-dashboard-${new Date().toISOString().slice(0, 7)}`,
      };

      if (isParallel) {
        // Parallel mode - fill all fields simultaneously with faster typing
        const fillPromises = [];
        
        // Always fill title and description for new dashboards (faster delays)
        fillPromises.push(typeText(content.title, (value) => setValue('title', value), 10));
        fillPromises.push(typeText(content.description, (value) => setValue('description', value), 15));
        
        // Fill path if it's a new dashboard
        if (isNew) {
          fillPromises.push(typeText(sharedContent.path, (value) => setValue('path', value), 10));
        }
        
        // Fill comment if not read-only
        if (!readOnly) {
          fillPromises.push(typeText(sharedContent.comment, (value) => setValue('comment', value), 20));
        }
        
        // Fill branch if workflow is set to branch
        if (workflow === 'branch') {
          fillPromises.push(typeText(sharedContent.branch, (value) => setValue('ref', value), 10));
        }
        
        // Wait for all fields to complete simultaneously
        await Promise.all(fillPromises);
      } else {
        // Serial mode - fill fields one by one (original behavior)
        // Fill title first
        await typeText(content.title, (value) => setValue('title', value));
        
        // Small delay between fields
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Then fill description
        await typeText(content.description, (value) => setValue('description', value), 30);
        
        // Small delay before shared fields
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Fill path if it's a new dashboard
        if (isNew) {
          await typeText(sharedContent.path, (value) => setValue('path', value));
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Fill comment if not read-only
        if (!readOnly) {
          await typeText(sharedContent.comment, (value) => setValue('comment', value), 40);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Fill branch if workflow is set to branch
        if (workflow === 'branch') {
          await typeText(sharedContent.branch, (value) => setValue('ref', value));
        }
      }
    } catch (error) {
      console.error('AI autofill all error:', error);
    } finally {
      setAiLoading(prev => ({ ...prev, all: false }));
    }
  };

  // Always use serial mode for the regular autofill button
  const handleAIFillAll = async () => {
    await handleAIFillAllInternal(false);
  };

  // Submit handler for saving the form data
  const handleFormSubmit = async ({ title, description, repo, path, comment, ref }: ProvisionedDashboardFormData) => {
    // Validate required fields
    if (!repo || !path) {
      console.error('Missing required fields for saving:', { repo, path });
      return;
    }

    // If user is writing to the original branch, override ref with whatever we loaded from
    if (workflow === 'write') {
      ref = loadedFromRef;
    }

    const body = dashboard.getSaveResource({
      isNew,
      title,
      description,
    });

    createOrUpdateFile({
      ref,
      name: repo,
      path,
      message: comment,
      body,
    });
  };

  // Magic save handler that combines AI autofill and save
  const handleMagicSave = async () => {
    if (readOnly) {return;}
    
    setAiLoading(prev => ({ ...prev, magicSave: true }));
    
    try {
      // First fill all fields with AI in parallel mode for faster execution
      await handleAIFillAllInternal(true);
      
      // Shorter wait for form to update since parallel is faster
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Then trigger the save using the form's submit handler
      const formData = methods.getValues();
      
      // Validate that we have the required fields
      if (!formData.title || !formData.path) {
        throw new Error('Required fields are missing after AI autofill');
      }
      
      await handleFormSubmit(formData);
    } catch (error) {
      console.error('Magic save error:', error);
      // Show error to user
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.save-provisioned-dashboard-form.magic-save-error', 'Magic save failed'), 
          error
        ],
      });
    } finally {
      setAiLoading(prev => ({ ...prev, magicSave: false }));
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} name="save-provisioned-form">
        <Stack direction="column" gap={2}>
          {readOnly && (
            <Alert
              title={t(
                'dashboard-scene.save-provisioned-dashboard-form.title-this-repository-is-read-only',
                'This repository is read only'
              )}
            >
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.copy-json-message">
                If you have direct access to the target, copy the JSON and paste it there.
              </Trans>
            </Alert>
          )}

          {isNew && (
            <>
              <Field
                noMargin
                label={t('dashboard-scene.save-provisioned-dashboard-form.label-title', 'Title')}
                invalid={!!methods.formState.errors.title}
                error={methods.formState.errors.title?.message}
              >
                <Input
                  id="dashboard-title"
                  suffix={
                    <IconButton
                      name={aiLoading.title ? "spinner" : "ai-sparkle"}
                      tooltip={t(
                        'dashboard-scene.save-provisioned-dashboard-form.ai-fill-title',
                        'AI autofill title'
                      )}
                      onClick={handleAIFillTitle}
                      variant="secondary"
                      size="sm"
                      disabled={aiLoading.title || aiLoading.all}
                    />
                  }
                  {...register('title', {
                    required: t(
                      'dashboard-scene.save-provisioned-dashboard-form.title-required',
                      'Dashboard title is required'
                    ),
                    validate: validateTitle,
                  })}
                />
              </Field>
              <Field
                noMargin
                label={t('dashboard-scene.save-provisioned-dashboard-form.label-description', 'Description')}
                invalid={!!methods.formState.errors.description}
                error={methods.formState.errors.description?.message}
              >
                <TextAreaWithSuffix
                  id="dashboard-description"
                  value={description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue('description', e.target.value)}
                  suffix={
                    <IconButton
                      name={aiLoading.description ? "spinner" : "ai-sparkle"}
                      tooltip={t(
                        'dashboard-scene.save-provisioned-dashboard-form.ai-fill-description',
                        'AI autofill description'
                      )}
                      onClick={handleAIFillDescription}
                      variant="secondary"
                      size="sm"
                      disabled={aiLoading.description || aiLoading.all}
                    />
                  }
                />
              </Field>

              <Field
                noMargin
                label={t('dashboard-scene.save-provisioned-dashboard-form.label-target-folder', 'Target folder')}
              >
                <Controller
                  control={control}
                  name={'folder'}
                  render={({ field: { ref, value, onChange, ...field } }) => {
                    return (
                      <FolderPicker
                        onChange={async (uid?: string, title?: string) => {
                          onChange({ uid, title });
                          // Update folderUid URL param
                          updateURLParams('folderUid', uid);
                          const meta = await getProvisionedMeta(uid);
                          dashboard.setState({
                            meta: {
                              ...meta,
                              folderUid: uid,
                            },
                          });
                        }}
                        value={value.uid}
                        {...field}
                      />
                    );
                  }}
                />
              </Field>
            </>
          )}

          {!isNew && !readOnly && <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />}

          <DashboardEditFormSharedFields
            resourceType="dashboard"
            readOnly={readOnly}
            workflow={workflow}
            workflowOptions={workflowOptions}
            isGitHub={isGitHub}
            isNew={isNew}
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
          />

          {/* Comprehensive AI autofill button for all fields */}
          {isNew && (
            <Button
              variant="secondary"
              size="sm"
              icon={aiLoading.all ? "spinner" : "ai-sparkle"}
              onClick={handleAIFillAll}
              fill="outline"
              disabled={Object.values(aiLoading).some(loading => loading)}
              tooltip={t(
                'dashboard-scene.save-provisioned-dashboard-form.ai-fill-all-tooltip',
                'AI autofill all fields sequentially'
              )}
            >
              {aiLoading.all 
                ? t('dashboard-scene.save-provisioned-dashboard-form.ai-generating', 'Generating all fields...')
                : t('dashboard-scene.save-provisioned-dashboard-form.ai-fill-all-comprehensive', 'AI autofill all fields')
              }
            </Button>
          )}

          <Stack gap={2}>
            <Stack direction="row" gap={2}>
              <Button variant="primary" type="submit" disabled={request.isLoading || !isDirty || readOnly}>
                {request.isLoading
                  ? t('dashboard-scene.save-provisioned-dashboard-form.saving', 'Saving...')
                  : t('dashboard-scene.save-provisioned-dashboard-form.save', 'Save')}
              </Button>
              <Button 
                variant="secondary" 
                icon={aiLoading.magicSave ? "spinner" : "ai-sparkle"}
                onClick={handleMagicSave}
                                  disabled={aiLoading.magicSave || request.isLoading || readOnly || Object.values(aiLoading).some(loading => loading)}
                  tooltip={t(
                    'dashboard-scene.save-provisioned-dashboard-form.magic-save-tooltip',
                    'AI autofill all fields in parallel and save instantly'
                  )}
                              >
                  {aiLoading.magicSave 
                    ? t('dashboard-scene.save-provisioned-dashboard-form.magic-saving', 'Saving...')
                    : t('dashboard-scene.save-provisioned-dashboard-form.magic-save', 'Save')
                  }
                </Button>
            </Stack>
            <Button variant="secondary" onClick={drawer.onClose} fill="outline">
              <Trans i18nKey="dashboard-scene.save-provisioned-dashboard-form.cancel">Cancel</Trans>
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

/**
 * Dashboard title validation to ensure it's not the same as the folder name
 * and meets other naming requirements.
 */
async function validateTitle(title: string, formValues: ProvisionedDashboardFormData) {
  if (title === formValues.folder.title?.trim()) {
    return t(
      'dashboard-scene.save-provisioned-dashboard-form.title-same-as-folder',
      'Dashboard name cannot be the same as the folder name'
    );
  }
  try {
    await validationSrv.validateNewDashboardName(formValues.folder.uid ?? 'general', title);
    return true;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : t(
          'dashboard-scene.save-provisioned-dashboard-form.title-validation-failed',
          'Dashboard title validation failed.'
        );
  }
}

// Update the URL params without reloading the page
function updateURLParams(param: string, value?: string) {
  if (!value) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.replaceState({}, '', url);
}
