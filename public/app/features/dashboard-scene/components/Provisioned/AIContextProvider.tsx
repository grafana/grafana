import { createContext, useContext, useCallback, ReactNode } from 'react';

import { useLLMStream } from 'app/features/dashboard/components/GenAI/hooks';
import { Message, Role, DEFAULT_LLM_MODEL, sanitizeReply } from 'app/features/dashboard/components/GenAI/utils';

import { DashboardChangeInfo } from '../../saving/shared';

interface AIContextValue {
  // LLM streams for different fields
  titleLLMStream: ReturnType<typeof useLLMStream>;
  descriptionLLMStream: ReturnType<typeof useLLMStream>;
  commentLLMStream: ReturnType<typeof useLLMStream>;
  pathLLMStream: ReturnType<typeof useLLMStream>;
  branchLLMStream: ReturnType<typeof useLLMStream>;
  
  // Message generation functions
  getTitleMessages: (dashboardContext: any, changeInfo?: DashboardChangeInfo) => Message[];
  getDescriptionMessages: (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo) => Message[];
  getCommentMessages: (dashboardContext: any, currentTitle: string, currentDescription: string, changeInfo?: DashboardChangeInfo) => Message[];
  getPathMessages: (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo) => Message[];
  getBranchMessages: (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo) => Message[];
  
  // Utility functions
  summarizeDiffs: (diffs: Record<string, any[]>) => string;
  getChangeDetails: (changeInfo?: DashboardChangeInfo) => { changeDetails: string; diffSummary: string };
}

const AIContext = createContext<AIContextValue | null>(null);

interface AIContextProviderProps {
  children: ReactNode;
  setValue: (field: any, value: any) => void;
  setAiLoading?: (updater: (prev: any) => any) => void;
}

export function AIContextProvider({ children, setValue, setAiLoading }: AIContextProviderProps) {
  // Helper to summarize diffs for LLM prompt
  const summarizeDiffs = useCallback((diffs: Record<string, any[]>): string => {
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
  }, []);

  // LLM stream hooks for each field
  const titleLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.7,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('title', sanitized);
      setAiLoading && setAiLoading(prev => ({ ...prev, title: false }));
    }, [setValue, setAiLoading])
  });

  const descriptionLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.8,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('description', sanitized);
      setAiLoading && setAiLoading(prev => ({ ...prev, description: false }));
    }, [setValue, setAiLoading])
  });

  const commentLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.8,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('comment', sanitized);
      setAiLoading && setAiLoading(prev => ({ ...prev, comment: false }));
    }, [setValue, setAiLoading])
  });

  const pathLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.6,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('path', sanitized);
      setAiLoading && setAiLoading(prev => ({ ...prev, path: false }));
    }, [setValue, setAiLoading])
  });

  const branchLLMStream = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.7,
    onResponse: useCallback((response: string) => {
      const sanitized = sanitizeReply(response);
      setValue('ref', sanitized);
      setAiLoading && setAiLoading(prev => ({ ...prev, branch: false }));
    }, [setValue, setAiLoading])
  });

  // Utility function to extract change details and diff summary from changeInfo
  const getChangeDetails = (changeInfo?: DashboardChangeInfo) => {
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
    
    return { changeDetails, diffSummary };
  };

  // Message generation functions
  const getTitleMessages = (dashboardContext: any, changeInfo?: DashboardChangeInfo): Message[] => {
    const { changeDetails } = getChangeDetails(changeInfo);
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in creating Grafana Dashboard titles.
Your goal is to write a concise, descriptive dashboard title.
The title should be clear, professional, and indicate what the dashboard monitors or displays.
It should be between 15-60 characters and capture the essence of the dashboard's purpose.
Do not include quotes in your response.
Focus on the main purpose or system being monitored.
Look at the changes being made to the dashboard and use the changes to create a descriptive title.
Fropm the changes, try to indentify the services being monitored via the panel titles, descriptions and queries.

Examples:
- If the new dashboard contains panels for monitoring the RED metrics of a service called "api", the title may look like this: "API RED Metrics"
- If the dashboard contains panels for monitoring the CPU and Memory usage of a service called "api", the title may look like this: "API CPU and Memory Usage"
- If the dashboard contains penels for displaying the sales of a team, the title may look like this: "Team Sales"
- If the dashboard contains panels for monitoring the temperature of a domotic home, the title may look like this: "Home Temperature"

Do not include the word "dashboard" in the title.
Do not include quotes in your response.
`
      },
      {
        role: Role.user,
        content: `Create a title for a dashboard with:
Current title: "${dashboardContext.title}"
Tags: ${dashboardContext.tags.join(', ') || 'None'}
${dashboardContext.isNew ? 'This is a new dashboard that will contain monitoring visualizations.' : 'This is an existing dashboard being updated.'}
These are the changes being made to the dashboard: ${changeDetails}`
      }
    ];

    console.log('AI Title Generation - Context:', { dashboardContext, changeInfo });
    console.log('AI Title Generation - Messages:', messages);

    return messages;
  };

  const getDescriptionMessages = (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo): Message[] => {
    const { changeDetails } = getChangeDetails(changeInfo);
    
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
  'This dashboard provides monitoring and analytics capabilities and is being updated.'}
These are the changes being made to the dashboard: ${changeDetails}`
      }
    ];

    console.log('AI Description Generation - Context:', { dashboardContext, currentTitle, changeInfo });
    console.log('AI Description Generation - Messages:', messages);

    return messages;
  };

  const getCommentMessages = (dashboardContext: any, currentTitle: string, currentDescription: string, changeInfo?: DashboardChangeInfo): Message[] => {
    const { changeDetails } = getChangeDetails(changeInfo);
    
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

${dashboardContext.isNew ? 'This is a new dashboard being added to the repository.' : 'This is an update to an existing dashboard.'}
These are the changes being made to the dashboard: ${changeDetails}`
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
    });
    console.log('AI Comment Generation - Messages:', messages);

    return messages;
  };

  const getPathMessages = (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo): Message[] => {
    const currentYear = new Date().getFullYear();
    const { changeDetails } = getChangeDetails(changeInfo);
    
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
This should be a well-organized path within a Git repository.
These are the changes being made to the dashboard: ${changeDetails}`
      }
    ];

    console.log('AI Path Generation - Context:', { dashboardContext, currentTitle, currentYear, changeInfo });
    console.log('AI Path Generation - Messages:', messages);

    return messages;
  };

  const getBranchMessages = (dashboardContext: any, currentTitle: string, changeInfo?: DashboardChangeInfo): Message[] => {
    const { changeDetails } = getChangeDetails(changeInfo);
    
    const messages = [
      {
        role: Role.system,
        content: `You are an expert in Git branch naming conventions.
Your goal is to create a descriptive branch name that follows Git best practices.
The branch name should be lowercase, use hyphens to separate words, and be concise but descriptive.

- Use this prefix if the dashboard is updated: update/
- Use this prefix if the dashboard is added: feature/

Besides the prefixes, the branch name should be between 15-50 characters.
Look at the changes being made to the dashboard and use the changes to create a descriptive branch name.

Examples:
- If the changes are to add a new panel named "CPU Usage" to a dashboard titled "API Performance", the branch name should look like this (example): feature/add-new-panel-cpu-usage-to-api-performance
- If the changes are to update the dashboard title to "API Performance", the branch name should look like this (example): update/update-dashboard-title-to-api-performance
- If the changes are to update the dashboard description for a dashboard titled "API Performance", the branch name should look like this (example): update/api-performance-dashboard-description
- If the changes are to update the dashboard tags to "monitoring, analytics" for a dashboard titled "API Performance", the branch name should look like this (example): update/api-performance-dashboard-tags
- If the changes are to update the dashboard time range to "Last 30 days" for a dashboard titled "API Performance", the branch name should look like this (example): update/api-performance-dashboard-time-range
- If the changes are to update the dashboard refresh interval to "10 seconds" for a dashboard titled "API Performance", the branch name should look like this (example): update/api-performance-dashboard-refresh-interval
- If the changes are to update the dashboard folder location for a dashboard titled "API Performance", the branch name should look like this (example): update/api-performance-dashboard-folder-location

Do not include quotes in your response.`
      },
      {
        role: Role.user,
        content: `Create a Git branch name for ${dashboardContext.isNew ? 'adding' : 'updating'} a dashboard titled: "${currentTitle}"
These are the changes being made to the dashboard: ${changeDetails}`
      }
    ];

    console.log('AI Branch Generation - Context:', { dashboardContext, currentTitle, changeInfo });
    console.log('AI Branch Generation - Messages:', messages);

    return messages;
  };

  const value: AIContextValue = {
    titleLLMStream,
    descriptionLLMStream,
    commentLLMStream,
    pathLLMStream,
    branchLLMStream,
    getTitleMessages,
    getDescriptionMessages,
    getCommentMessages,
    getPathMessages,
    getBranchMessages,
    summarizeDiffs,
    getChangeDetails,
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
} 
