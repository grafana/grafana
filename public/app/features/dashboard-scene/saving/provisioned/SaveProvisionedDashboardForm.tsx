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
import { useLLMStream, StreamStatus } from 'app/features/dashboard/components/GenAI/hooks';
import { isLLMPluginEnabled, Message, Role, DEFAULT_LLM_MODEL, sanitizeReply } from 'app/features/dashboard/components/GenAI/utils';
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

// Helper to summarize diffs for LLM prompt
function summarizeDiffs(diffs: Record<string, any[]>): string {
  if (!diffs) {
    return '';
  }
  const lines: string[] = [];
  let count = 0;
  for (const [section, changes] of Object.entries(diffs)) {
    for (const diff of changes) {
      if (count >= 5) {
        lines.push('...and more');
        break;
      }
      const opText = diff.op === 'add' ? 'added' : diff.op === 'remove' ? 'removed' : 'changed';
      const path = diff.path.join('.');
      let desc = '';
      if (diff.op === 'replace') {
        desc = `from "${String(diff.originalValue)}" to "${String(diff.value)}"`;
      } else if (diff.op === 'add') {
        desc = `set to "${String(diff.value)}"`;
      } else if (diff.op === 'remove') {
        desc = `was "${String(diff.originalValue)}"`;
      }
      lines.push(`- ${section}: ${opText} ${path}${desc ? ' ' + desc : ''}`);
      count++;
    }
    if (count >= 5) {
      break;
    }
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

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
    magicSave: false,
  });

  // LLM state
  const [isLLMEnabled, setIsLLMEnabled] = useState(false);

  // Check if LLM is enabled
  useEffect(() => {
    isLLMPluginEnabled().then(setIsLLMEnabled);
  }, []);

  // LLM stream hooks for title and description
  const titleLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.7,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('title', sanitized);
      setAiLoading(prev => ({ ...prev, title: false }));
    }, [setValue])
  });

  const descriptionLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.8,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('description', sanitized);
      setAiLoading(prev => ({ ...prev, description: false }));
    }, [setValue])
  });

  // LLM stream for comment generation
  const commentLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.8,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('comment', sanitized);
      setAiLoading(prev => ({ ...prev, comment: false }));
    }, [setValue])
  });

  // LLM stream for path generation
  const pathLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.6,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('path', sanitized);
      setAiLoading(prev => ({ ...prev, path: false }));
    }, [setValue])
  });

  // LLM stream for branch generation
  const branchLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.7,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('ref', sanitized);
      setAiLoading(prev => ({ ...prev, branch: false }));
    }, [setValue])
  });

  // Update the form if default values change
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Helper function to get dashboard context for AI generation
  const getDashboardContext = useCallback(() => {
    const dashboardModel = {
      title: dashboard.state.title || 'Untitled Dashboard',
      tags: dashboard.state.tags || [],
      isNew: isNew,
      changeInfo: changeInfo ? {
        hasChanges: changeInfo.hasChanges,
        hasTimeChanges: changeInfo.hasTimeChanges,
        hasVariableValueChanges: changeInfo.hasVariableValueChanges,
        hasRefreshChange: changeInfo.hasRefreshChange,
        hasFolderChanges: changeInfo.hasFolderChanges,
        hasMigratedToV2: changeInfo.hasMigratedToV2,
        diffCount: changeInfo.diffCount,
      } : null,
    };
    return dashboardModel;
  }, [dashboard.state, isNew, changeInfo]);

  // Helper function to create title generation messages
  const getTitleMessages = useCallback((): Message[] => {
    const dashboardContext = getDashboardContext();
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in creating Grafana Dashboard titles.
Your goal is to write a concise, descriptive dashboard title.
The title should be clear, professional, and indicate what the dashboard monitors or displays.
It should be between 15-60 characters and capture the essence of the dashboard's purpose.
Do not include quotes in your response.
Focus on the main purpose or system being monitored.`
      },
      {
        role: Role.user,
        content: `Create a title for a dashboard with:
Current title: "${dashboardContext.title}"
Tags: ${dashboardContext.tags.join(', ') || 'None'}
${dashboardContext.isNew ? 'This is a new dashboard that will contain monitoring visualizations.' : 'This is an existing dashboard being updated.'}`
      }
    ];

    console.log('AI Title Generation - Context:', { dashboardContext });
    console.log('AI Title Generation - Messages:', messages);

    return messages;
  }, [getDashboardContext]);

  // Helper function to create description generation messages
  const getDescriptionMessages = useCallback((): Message[] => {
    const dashboardContext = getDashboardContext();
    const currentTitle = watch('title') || dashboardContext.title;
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in creating Grafana Dashboard descriptions.
Your goal is to write a descriptive and informative dashboard description.
The description should explain the purpose of the dashboard, what it monitors, and what insights it provides.
It should be between 100-300 characters and be helpful for users to understand the dashboard's value.
Do not include quotes in your response.
Focus on the business value and monitoring capabilities.`
      },
      {
        role: Role.user,
        content: `Create a description for a dashboard titled: "${currentTitle}"
Tags: ${dashboardContext.tags.join(', ') || 'None'}
${dashboardContext.isNew ? 
  'This dashboard will provide comprehensive monitoring and analytics for system performance and health.' : 
  'This dashboard provides monitoring and analytics capabilities and is being updated.'}`
      }
    ];

    console.log('AI Description Generation - Context:', { dashboardContext, currentTitle });
    console.log('AI Description Generation - Messages:', messages);

    return messages;
  }, [getDashboardContext, watch]);

  // Helper function to create comment generation messages
  const getCommentMessages = useCallback((): Message[] => {
    const dashboardContext = getDashboardContext();
    const currentTitle = watch('title') || dashboardContext.title;
    const currentDescription = watch('description') || '';
    
    // Build change details from changeInfo
    let changeDetails = '';
    let diffSummary = '';
    if (changeInfo) {
      const changes = [];
      
      if (changeInfo.hasTimeChanges) {
        changes.push('time range');
      }
      if (changeInfo.hasVariableValueChanges) {
        changes.push('variable values');
      }
      if (changeInfo.hasRefreshChange) {
        changes.push('refresh interval');
      }
      if (changeInfo.hasFolderChanges) {
        changes.push('folder location');
      }
      if (changeInfo.hasMigratedToV2) {
        changes.push('dashboard format migration');
      }
      
      // Add general changes if specific changes aren't detected
      if (changes.length === 0 && changeInfo.hasChanges) {
        changes.push('dashboard configuration');
      }
      
      if (changes.length > 0) {
        changeDetails = `\n\nChanges detected: ${changes.join(', ')}`;
        if (changeInfo.diffCount > 0) {
          changeDetails += ` (${changeInfo.diffCount} total changes)`;
        }
      }
      // Add diff summary
      if (changeInfo.diffs) {
        diffSummary = summarizeDiffs(changeInfo.diffs);
        if (diffSummary) {
          changeDetails += `\n\nExample changes:\n${diffSummary}`;
        }
      }
    }
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in Git version control and dashboard management.

Your goal is to write a clear, descriptive Git commit message that explains the changes being made to this dashboard.

The commit message should be professional, concise, and follow Git best practices.

It should not be longer than 100 words and explain what this change accomplishes.

Focus on the specific changes made rather than generic descriptions.

Do not include quotes in your response.`
      },
      {
        role: Role.user,
        content: `Create a Git commit message for ${dashboardContext.isNew ? 'adding a new' : 'updating an existing'} dashboard with:

${dashboardContext.isNew ? 'This is a new dashboard being added to the repository.' : 'This is an update to an existing dashboard.'}${changeDetails}`
      }
    ];

    // Log the context and messages being sent to LLM
    console.log('AI Comment Generation - Context:', {
      dashboardContext,
      currentTitle,
      currentDescription,
      changeInfo: changeInfo ? {
        hasChanges: changeInfo.hasChanges,
        hasTimeChanges: changeInfo.hasTimeChanges,
        hasVariableValueChanges: changeInfo.hasVariableValueChanges,
        hasRefreshChange: changeInfo.hasRefreshChange,
        hasFolderChanges: changeInfo.hasFolderChanges,
        hasMigratedToV2: changeInfo.hasMigratedToV2,
        diffCount: changeInfo.diffCount,
        diffs: changeInfo.diffs ? Object.keys(changeInfo.diffs) : null,
      } : null,
      changeDetails,
      diffSummary,
    });
    console.log('AI Comment Generation - Messages:', messages);

    return messages;
  }, [getDashboardContext, watch, changeInfo]);

  // Helper function to create path generation messages
  const getPathMessages = useCallback((): Message[] => {
    const dashboardContext = getDashboardContext();
    const currentTitle = watch('title') || dashboardContext.title;
    const currentYear = new Date().getFullYear();
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in file organization and naming conventions.
Your goal is to create a logical file path for storing a dashboard in a repository.
The path should be organized, follow naming conventions, and include appropriate subdirectories.
For dashboards, use .json extension. Use lowercase with hyphens for separation.
Consider organizing by year, category, or purpose.
The path should be between 20-80 characters.
Do not include quotes in your response.`
      },
      {
        role: Role.user,
        content: `Create a file path for a dashboard titled: "${currentTitle}" 
Current year: ${currentYear}
This should be a well-organized path within a Git repository.`
      }
    ];

    console.log('AI Path Generation - Context:', { dashboardContext, currentTitle, currentYear });
    console.log('AI Path Generation - Messages:', messages);

    return messages;
  }, [getDashboardContext, watch]);

  // Helper function to create branch name generation messages
  const getBranchMessages = useCallback((): Message[] => {
    const dashboardContext = getDashboardContext();
    const currentTitle = watch('title') || dashboardContext.title;
    
    const messages = [
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
        content: `Create a Git branch name for ${dashboardContext.isNew ? 'adding' : 'updating'} a dashboard titled: "${currentTitle}"`
      }
    ];

    console.log('AI Branch Generation - Context:', { dashboardContext, currentTitle });
    console.log('AI Branch Generation - Messages:', messages);

    return messages;
  }, [getDashboardContext, watch]);

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

  // AI handler functions with LLM integration
  const handleAIFillTitle = async () => {
    console.log('AI Autofill - Title generation started');
    
    if (!isLLMEnabled) {
      console.log('LLM is not enabled');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, title: true }));
    
    try {
      const messages = getTitleMessages();
      console.log('AI Autofill - Setting title messages:', messages);
      titleLLMStream.setMessages(messages);
    } catch (error) {
      console.error('AI autofill title error:', error);
      setAiLoading(prev => ({ ...prev, title: false }));
    }
  };

  const handleAIFillDescription = async () => {
    console.log('AI Autofill - Description generation started');
    
    if (!isLLMEnabled) {
      console.log('LLM is not enabled');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, description: true }));
    
    try {
      const messages = getDescriptionMessages();
      console.log('AI Autofill - Setting description messages:', messages);
      descriptionLLMStream.setMessages(messages);
    } catch (error) {
      console.error('AI autofill description error:', error);
      setAiLoading(prev => ({ ...prev, description: false }));
    }
  };

  // Update loading states based on stream status
  useEffect(() => {
    if (titleLLMStream.streamStatus === StreamStatus.GENERATING) {
      setAiLoading(prev => ({ ...prev, title: true }));
    } else if (titleLLMStream.streamStatus === StreamStatus.COMPLETED || titleLLMStream.error) {
      setAiLoading(prev => ({ ...prev, title: false }));
    }
  }, [titleLLMStream.streamStatus, titleLLMStream.error]);

  useEffect(() => {
    if (descriptionLLMStream.streamStatus === StreamStatus.GENERATING) {
      setAiLoading(prev => ({ ...prev, description: true }));
    } else if (descriptionLLMStream.streamStatus === StreamStatus.COMPLETED || descriptionLLMStream.error) {
      setAiLoading(prev => ({ ...prev, description: false }));
    }
  }, [descriptionLLMStream.streamStatus, descriptionLLMStream.error]);

  useEffect(() => {
    if (commentLLMStream.streamStatus === StreamStatus.GENERATING) {
      setAiLoading(prev => ({ ...prev, comment: true }));
    } else if (commentLLMStream.streamStatus === StreamStatus.COMPLETED || commentLLMStream.error) {
      setAiLoading(prev => ({ ...prev, comment: false }));
    }
  }, [commentLLMStream.streamStatus, commentLLMStream.error]);

  useEffect(() => {
    if (pathLLMStream.streamStatus === StreamStatus.GENERATING) {
      setAiLoading(prev => ({ ...prev, path: true }));
    } else if (pathLLMStream.streamStatus === StreamStatus.COMPLETED || pathLLMStream.error) {
      setAiLoading(prev => ({ ...prev, path: false }));
    }
  }, [pathLLMStream.streamStatus, pathLLMStream.error]);

  useEffect(() => {
    if (branchLLMStream.streamStatus === StreamStatus.GENERATING) {
      setAiLoading(prev => ({ ...prev, branch: true }));
    } else if (branchLLMStream.streamStatus === StreamStatus.COMPLETED || branchLLMStream.error) {
      setAiLoading(prev => ({ ...prev, branch: false }));
    }
  }, [branchLLMStream.streamStatus, branchLLMStream.error]);

  const handleAIFillAllInternal = async (isParallel = false) => {
    console.log('AI Autofill - Internal autofill started', { isParallel, isNew, readOnly, workflow });
    
    setAiLoading(prev => ({ ...prev, all: true }));
    
    try {
      if (!isLLMEnabled) {
        console.log('LLM is not enabled');
        return;
      }

      // Helper function to wait for a field to complete generation
      const waitForFieldCompletion = (fieldName: keyof typeof aiLoading) => {
        return new Promise<void>((resolve) => {
          const checkCompletion = () => {
            if (!aiLoading[fieldName]) {
              console.log(`AI Autofill - Field ${fieldName} completed`);
              resolve();
            } else {
              setTimeout(checkCompletion, 100);
            }
          };
          checkCompletion();
        });
      };

      if (isParallel) {
        console.log('AI Autofill - Starting parallel mode');
        // Parallel mode - trigger all LLM streams simultaneously
        const promises = [];
        
        // Always fill title and description for new dashboards
        console.log('AI Autofill - Triggering title generation');
        titleLLMStream.setMessages(getTitleMessages());
        promises.push(waitForFieldCompletion('title'));
        
        console.log('AI Autofill - Triggering description generation');
        descriptionLLMStream.setMessages(getDescriptionMessages());
        promises.push(waitForFieldCompletion('description'));
        
        // Fill path if it's a new dashboard
        if (isNew) {
          console.log('AI Autofill - Triggering path generation');
          pathLLMStream.setMessages(getPathMessages());
          promises.push(waitForFieldCompletion('path'));
        }
        
        // Fill comment if not read-only
        if (!readOnly) {
          console.log('AI Autofill - Triggering comment generation');
          commentLLMStream.setMessages(getCommentMessages());
          promises.push(waitForFieldCompletion('comment'));
        }
        
        // Fill branch if workflow is set to branch
        if (workflow === 'branch') {
          console.log('AI Autofill - Triggering branch generation');
          branchLLMStream.setMessages(getBranchMessages());
          promises.push(waitForFieldCompletion('branch'));
        }
        
        // Wait for all LLM streams to complete
        console.log('AI Autofill - Waiting for all parallel operations to complete');
        await Promise.all(promises);
      } else {
        console.log('AI Autofill - Starting serial mode');
        // Serial mode - fill fields one by one using LLM
        
        // Fill title first
        console.log('AI Autofill - Triggering title generation (serial)');
        titleLLMStream.setMessages(getTitleMessages());
        await waitForFieldCompletion('title');
        
        // Small delay between fields
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Then fill description
        console.log('AI Autofill - Triggering description generation (serial)');
        descriptionLLMStream.setMessages(getDescriptionMessages());
        await waitForFieldCompletion('description');
        
        // Small delay before shared fields
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Fill path if it's a new dashboard
        if (isNew) {
          console.log('AI Autofill - Triggering path generation (serial)');
          pathLLMStream.setMessages(getPathMessages());
          await waitForFieldCompletion('path');
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Fill comment if not read-only
        if (!readOnly) {
          console.log('AI Autofill - Triggering comment generation (serial)');
          commentLLMStream.setMessages(getCommentMessages());
          await waitForFieldCompletion('comment');
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Fill branch if workflow is set to branch
        if (workflow === 'branch') {
          console.log('AI Autofill - Triggering branch generation (serial)');
          branchLLMStream.setMessages(getBranchMessages());
          await waitForFieldCompletion('branch');
        }
      }
      
      console.log('AI Autofill - Internal autofill completed successfully');
    } catch (error) {
      console.error('AI autofill all error:', error);
    } finally {
      setAiLoading(prev => ({ ...prev, all: false }));
    }
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

  // Traditional save handler
  const handleTraditionalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Execute the normal form submit
      const formData = methods.getValues();
      await handleFormSubmit(formData);
    } catch (error) {
      console.error('Traditional save failed:', error);
    }
  };

  // AI autofill handler that fills all fields with AI-generated content
  const handleAIAutofill = async () => {
    console.log('AI Autofill - Starting autofill all fields');
    
    if (readOnly) {
      console.log('AI Autofill - Skipping due to read-only mode');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, magicSave: true }));
    
    try {
      console.log('AI Autofill - Executing parallel autofill');
      // Fill all fields with AI in parallel mode for faster execution
      await handleAIFillAllInternal(true);
      
      // Don't automatically save - let user manually save after autofill
      console.log('AI Autofill - Autofill completed - user can now save manually');
    } catch (error) {
      console.error('AI autofill error:', error);
      // Show error to user
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [
          t('dashboard-scene.save-provisioned-dashboard-form.autofill-error', 'AI autofill failed'), 
          error
        ],
      });
    } finally {
      setAiLoading(prev => ({ ...prev, magicSave: false }));
    }
  };

  // Don't show AI buttons if LLM is not enabled
  const showAIButtons = isLLMEnabled;

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
                    showAIButtons ? (
                      <IconButton
                        name={aiLoading.title ? "spinner" : "ai-sparkle"}
                        tooltip={t(
                          'dashboard-scene.save-provisioned-dashboard-form.ai-fill-title',
                          'AI autofill title'
                        )}
                        onClick={handleAIFillTitle}
                        variant="secondary"
                        size="sm"
                        disabled={aiLoading.title}
                      />
                    ) : undefined
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
                    showAIButtons ? (
                      <IconButton
                        name={aiLoading.description ? "spinner" : "ai-sparkle"}
                        tooltip={t(
                          'dashboard-scene.save-provisioned-dashboard-form.ai-fill-description',
                          'AI autofill description'
                        )}
                        onClick={handleAIFillDescription}
                        variant="secondary"
                        size="sm"
                        disabled={aiLoading.description}
                      />
                    ) : undefined
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

          <Stack gap={2}>
            <Stack direction="row" gap={2}>
              {/* Primary button (left) - changes based on last used mode */}
              <Button 
                variant="primary"
                onClick={handleTraditionalSave}
                disabled={request.isLoading || !isDirty || readOnly}
                tooltip={t(
                  'dashboard-scene.save-provisioned-dashboard-form.traditional-save-tooltip',
                  'Save dashboard without AI assistance'
                )}
              >
                {request.isLoading && !aiLoading.magicSave
                  ? t('dashboard-scene.save-provisioned-dashboard-form.saving', 'Saving...')
                  : t('dashboard-scene.save-provisioned-dashboard-form.save', 'Save')}
              </Button>
              
              {/* Autofill button (right) - always visible when LLM is enabled */}
              {isLLMEnabled && (
                <Button 
                  variant="secondary"
                  icon={aiLoading.magicSave ? "spinner" : "ai-sparkle"}
                  onClick={handleAIAutofill}
                  disabled={aiLoading.magicSave || request.isLoading || readOnly || Object.values(aiLoading).some(loading => loading)}
                  tooltip={t(
                    'dashboard-scene.save-provisioned-dashboard-form.autofill-tooltip',
                    'AI autofill all fields'
                  )}
                >
                  {aiLoading.magicSave 
                    ? t('dashboard-scene.save-provisioned-dashboard-form.autofilling', 'Autofilling...')
                    : t('dashboard-scene.save-provisioned-dashboard-form.autofill', 'Autofill')
                  }
                </Button>
              )}
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
