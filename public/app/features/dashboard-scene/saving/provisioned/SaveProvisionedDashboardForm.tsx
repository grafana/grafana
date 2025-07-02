import { css } from '@emotion/css';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Controller, useForm, FormProvider, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Alert, Box, Button, Checkbox, Field, Input, Stack, TextArea, useStyles2, useTheme2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import kbn from 'app/core/utils/kbn';
import { Resource } from 'app/features/apiserver/types';
import { GenAIButton } from 'app/features/dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from 'app/features/dashboard/components/GenAI/tracking';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { PROVISIONING_URL } from 'app/features/provisioning/constants';
import { useCreateOrUpdateRepositoryFile } from 'app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile';

import { AIContextProvider, useAIContext } from '../../components/Provisioned/AIContextProvider';
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

const LOCAL_STORAGE_ALWAYS_AUTOGEN_KEY = 'grafana-dashboard-always-autogen-all';

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

const SaveProvisionedDashboardFormInner = ({
  defaultValues,
  dashboard,
  drawer,
  changeInfo,
  isNew,
  loadedFromRef,
  isGitHub,
  workflowOptions,
  readOnly,
}: Props) => {
  const navigate = useNavigate();
  const appEvents = getAppEvents();
  const { isDirty, editPanel: panelEditor } = dashboard.useState();

  const [createOrUpdateFile, request] = useCreateOrUpdateRepositoryFile(isNew ? undefined : defaultValues.path);

  const { handleSubmit, watch, control, reset, register, setValue, formState } =
    useFormContext<ProvisionedDashboardFormData>();

  const [isAiLoading, setAiLoading] = useState({
    title: false,
    description: false,
    path: false,
    comment: false,
    ref: false,
  });
  const [alwaysAutoGenAll, setAlwaysAutoGenAll] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_ALWAYS_AUTOGEN_KEY) === 'true';
  });

  const workflow = watch('workflow');

  const fieldsWithAIAutofill = useMemo(() => {
    const fields = ['comment'];

    if (isNew) {
      fields.push('title', 'description', 'path');
    }

    if (workflow === 'branch') {
      fields.push('ref');
    }

    return fields;
  }, [isNew, workflow]);

  const isAnyAiFieldLoading = Object.values(isAiLoading).some((value) => value);

  // LLM state
  const [isLLMEnabled, setIsLLMEnabled] = useState(false);

  // Check if LLM is enabled
  useEffect(() => {
    isLLMPluginEnabled().then(setIsLLMEnabled);
  }, []);

  // Get AI context
  const aiContext = useAIContext();

  // Update the form if default values change
  // TODO: this is causing the whole form to reset when the folder changes
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Helper function to get dashboard context for AI generation
  const getDashboardContext = useCallback(() => {
    const dashboardModel = {
      title: dashboard.state.title || 'Untitled Dashboard',
      tags: dashboard.state.tags || [],
      isNew: isNew,
      changeInfo: changeInfo
        ? {
            hasChanges: changeInfo.hasChanges,
            hasTimeChanges: changeInfo.hasTimeChanges,
            hasVariableValueChanges: changeInfo.hasVariableValueChanges,
            hasRefreshChange: changeInfo.hasRefreshChange,
            hasFolderChanges: changeInfo.hasFolderChanges,
            hasMigratedToV2: changeInfo.hasMigratedToV2,
            diffCount: changeInfo.diffCount,
          }
        : null,
    };
    return dashboardModel;
  }, [dashboard.state, isNew, changeInfo]);

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

  // Submit handler for saving the form data
  const handleFormSubmit = useCallback(
    async ({ title, description, repo, path, comment, ref }: ProvisionedDashboardFormData) => {
      console.log('handleFormSubmit', { title, description, repo, path, comment, ref });

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

      await createOrUpdateFile({
        ref,
        name: repo,
        path,
        message: comment,
        body,
      }).unwrap();
    },
    [workflow, loadedFromRef, dashboard, isNew, createOrUpdateFile]
  );

  const handleFormSubmitDebug = async (formData: any) => {
    console.log('handleFormSubmitDebug', formData);
    await handleFormSubmit(formData);
  };

  const nonDirtyAIFields = Object.keys(watch()).filter(
    (fieldName) =>
      fieldsWithAIAutofill.includes(fieldName) &&
      !formState.dirtyFields[fieldName as keyof ProvisionedDashboardFormData]
  );

  // Auto-generate all fields (trigger all GenAIButtons)
  const [hasAutoGeneratedAll, setHasAutoGeneratedAll] = useState(false);
  const autoGenerateAll = useCallback(() => {
    nonDirtyAIFields.forEach((fieldName) => {
      setAiLoading((prev) => ({ ...prev, [fieldName]: true }));
      const button = document.getElementById(`${fieldName}-ai-button-container`)?.querySelector('button');
      if (button) {
        button.click();
      }
    });
    setHasAutoGeneratedAll(true);
  }, [nonDirtyAIFields, setAiLoading]);

  // Reset when drawer is opened
  useEffect(() => {
    if (drawer.isActive && alwaysAutoGenAll && !hasAutoGeneratedAll) {
      autoGenerateAll();
      setHasAutoGeneratedAll(true);
    }
  }, [drawer.isActive, alwaysAutoGenAll, hasAutoGeneratedAll, autoGenerateAll]);

  // Per-field effect for autofill (title and description in main form)
  useEffect(() => {
    if (drawer.isActive && alwaysAutoGenAll && !hasAutoGeneratedAll && isNew) {
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

      // Click title and description buttons for new dashboards
      clickWithRetry('title-ai-button-container');
      clickWithRetry('description-ai-button-container');
    }
  }, [drawer.isActive, alwaysAutoGenAll, hasAutoGeneratedAll, isNew]);

  useEffect(() => {
    if (!drawer.isActive) {
      setHasAutoGeneratedAll(false);
    }
  }, [drawer.isActive]);

  // Handler for the checkbox
  const handleAutoGenCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAlwaysAutoGenAll(e.target.checked);
    localStorage.setItem(LOCAL_STORAGE_ALWAYS_AUTOGEN_KEY, e.target.checked ? 'true' : 'false');
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmitDebug)} name="save-provisioned-form">
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
              label={
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <span>{t('dashboard-scene.save-provisioned-dashboard-form.label-title', 'Title')}</span>
                  {isLLMEnabled && (
                    <div id="title-ai-button-container">
                      <GenAIButton
                        tooltip={t(
                          'dashboard-scene.save-provisioned-dashboard-form.ai-fill-title',
                          'AI autofill title'
                        )}
                        messages={aiContext.getTitleMessages(getDashboardContext(), changeInfo)}
                        onGenerate={(response) => {
                          setValue('title', response, { shouldDirty: true });
                          setAiLoading((prev) => ({ ...prev, title: false }));
                        }}
                        onError={() => setAiLoading((prev) => ({ ...prev, title: false }))}
                        onStopGeneration={() => setAiLoading((prev) => ({ ...prev, title: false }))}
                        eventTrackingSrc={EventTrackingSrc.dashboardTitle}
                      />
                    </div>
                  )}
                </Stack>
              }
              invalid={!!formState.errors.title}
              error={formState.errors.title?.message}
            >
              <Input
                id="dashboard-title"
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
              label={
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <span>{t('dashboard-scene.save-provisioned-dashboard-form.label-description', 'Description')}</span>
                  {isLLMEnabled && (
                    <div id="description-ai-button-container">
                      <GenAIButton
                        tooltip={t(
                          'dashboard-scene.save-provisioned-dashboard-form.ai-fill-description',
                          'AI autofill description'
                        )}
                        messages={aiContext.getDescriptionMessages(
                          getDashboardContext(),
                          watch('title') || getDashboardContext().title,
                          changeInfo
                        )}
                        onGenerate={(response) => {
                          setValue('description', response, { shouldDirty: true });
                          setAiLoading((prev) => ({ ...prev, description: false }));
                        }}
                        onError={() => setAiLoading((prev) => ({ ...prev, description: false }))}
                        onStopGeneration={() => setAiLoading((prev) => ({ ...prev, description: false }))}
                        eventTrackingSrc={EventTrackingSrc.dashboardDescription}
                      />
                    </div>
                  )}
                </Stack>
              }
              invalid={!!formState.errors.description}
              error={formState.errors.description?.message}
            >
              <Controller
                name="description"
                control={control}
                render={({ field }) => <TextAreaWithSuffix {...field} />}
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
          changeInfo={changeInfo}
          setAiLoading={setAiLoading}
          shouldAutoGenerateAll={drawer.isActive && alwaysAutoGenAll && !hasAutoGeneratedAll}
        />

        <Stack gap={2} direction="row" justifyContent="flex-start">
          <Button
            variant="secondary"
            icon={isAnyAiFieldLoading ? 'spinner' : 'ai-sparkle'}
            onClick={autoGenerateAll}
            disabled={request.isLoading || !isDirty || readOnly || hasAutoGeneratedAll}
            tooltip={t(
              'dashboard-scene.save-provisioned-dashboard-form.magic-save-tooltip',
              'Auto-generate all fields'
            )}
          >
            {isAnyAiFieldLoading
              ? t('dashboard-scene.save-provisioned-dashboard-form.magic-saving', 'Auto generating...')
              : t('dashboard-scene.save-provisioned-dashboard-form.magic-save', 'Auto generate all')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={request.isLoading || !isDirty || readOnly}
            tooltip={t('dashboard-scene.save-provisioned-dashboard-form.traditional-save-tooltip', 'Save dashboard')}
          >
            {request.isLoading
              ? t('dashboard-scene.save-provisioned-dashboard-form.saving', 'Saving...')
              : t('dashboard-scene.save-provisioned-dashboard-form.save', 'Save')}
          </Button>
        </Stack>
        <Box>
          <Checkbox
            value={alwaysAutoGenAll}
            disabled={!hasAutoGeneratedAll}
            onChange={handleAutoGenCheckboxChange}
            label={t(
              'dashboard-scene.save-provisioned-dashboard-form.always-autogen-checkbox',
              'Always auto-generate all fields when saving'
            )}
          />
        </Box>
      </Stack>
    </form>
  );
};

export function SaveProvisionedDashboardForm(props: Props) {
  const methods = useForm<ProvisionedDashboardFormData>({ defaultValues: props.defaultValues });
  const { setValue } = methods;

  return (
    <FormProvider {...methods}>
      <AIContextProvider setValue={setValue}>
        <SaveProvisionedDashboardFormInner {...props} />
      </AIContextProvider>
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
