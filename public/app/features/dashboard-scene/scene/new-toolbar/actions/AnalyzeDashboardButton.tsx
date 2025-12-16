import { useMemo } from 'react';

import { createAssistantContextItem, OpenAssistantProps, useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';

import { ToolbarActionProps } from '../types';

/**
 * A toolbar button that opens the Assistant to analyze the current dashboard.
 * Automatically creates context from dashboard data and opens the assistant with a prompt
 * to analyze and provide insights about the dashboard.
 */
export const AnalyzeDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return <AnalyzeDashboardButtonView dashboard={dashboard} openAssistant={openAssistant} />;
};

function AnalyzeDashboardButtonView({
  dashboard,
  openAssistant,
}: ToolbarActionProps & {
  openAssistant: (props: OpenAssistantProps) => void;
}) {
  const { uid, title, description } = dashboard.useState();

  // Create dashboard context from dashboard data
  const dashboardContext = useMemo(() => {
    const saveModel = dashboard.getSaveModel();

    return createAssistantContextItem('structured', {
      title: `Dashboard: ${title}`,
      data: {
        dashboard: {
          uid,
          title,
          description,
          // Include panel info for analysis
          panels:
            'panels' in saveModel && saveModel.panels
              ? saveModel.panels.map((panel) => ({
                  id: panel.id,
                  title: panel.title,
                  type: panel.type,
                  description: 'description' in panel ? panel.description : undefined,
                }))
              : [],
        },
      },
    });
  }, [dashboard, uid, title, description]);

  // Generate the analysis prompt
  const analyzePrompt = useMemo(() => {
    return `Analyze this dashboard "${title}" and provide insights.
- Summarize the purpose and content of this dashboard
- Review the panels and their visualizations
- Suggest improvements for better data visibility or organization
- Identify any potential issues or optimization opportunities`;
  }, [title]);

  const handleClick = () => {
    reportInteraction('grafana_assistant_app_analyze_dashboard_button_clicked', {
      origin: 'dashboard',
      dashboardUid: uid,
      dashboardTitle: title,
    });

    openAssistant({
      origin: 'dashboard',
      mode: 'assistant',
      prompt: analyzePrompt,
      context: [dashboardContext],
      autoSend: true,
    });
  };

  return (
    <ToolbarButton
      icon="ai-sparkle"
      tooltip={t('dashboard.toolbar.analyze-dashboard', 'Analyze dashboard with Assistant')}
      onClick={handleClick}
      data-testid="analyze-dashboard-button"
    />
  );
}
