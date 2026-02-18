import { PanelData } from '@grafana/data';
import { Dashboard, Panel } from '@grafana/schema';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { AssistantGenerationButton } from './AssistantGeneration';
import { GenAIButton } from './GenAIButton';
import { buildAssistantDescriptionPrompt } from './assistantContext';
import { useGenerationProvider } from './hooks';
import { EventTrackingSrc } from './tracking';
import { Message, Role, getFilteredPanelString } from './utils';

interface GenAIPanelDescriptionButtonProps {
  onGenerate: (description: string) => void;
  panel: Panel;
  dashboard?: Dashboard;
  data?: PanelData;
}

const PANEL_DESCRIPTION_CHAR_LIMIT = 200;

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.\n' +
  'You will be given the title and description of the dashboard the panel is in as well as the JSON for the panel.\n' +
  'Your goal is to write a descriptive and concise panel description.\n' +
  'The panel description is meant to explain the purpose of the panel, not just its attributes.\n' +
  'Do not refer to the panel; simply describe its purpose.\n' +
  'There should be no numbers in the description except for thresholds.\n' +
  `The description should be, at most, ${PANEL_DESCRIPTION_CHAR_LIMIT} characters.`;

export const GenAIPanelDescriptionButton = ({
  onGenerate,
  panel,
  dashboard: dashboardProp,
  data,
}: GenAIPanelDescriptionButtonProps) => {
  const { provider, isLoading } = useGenerationProvider();
  const dashboard = dashboardProp ?? getDashboardSrv().getCurrent()?.getSaveModelClone();

  if (isLoading || provider === 'none') {
    return null;
  }

  if (!dashboard) {
    return null;
  }

  if (provider === 'assistant') {
    return (
      <AssistantGenerationButton
        getPrompt={() => buildAssistantDescriptionPrompt(panel, dashboard, data)}
        onGenerate={onGenerate}
        eventTrackingSrc={EventTrackingSrc.panelDescription}
        toggleTipTitle={'Improve your panel description'}
      />
    );
  }

  // LLM plugin
  return (
    <GenAIButton
      messages={() => getLLMMessages(panel, dashboard)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.panelDescription}
      toggleTipTitle={'Improve your panel description'}
    />
  );
};

function getLLMMessages(panel: Panel, dashboard: Dashboard): Message[] {
  const panelString = getFilteredPanelString(panel);
  const parts: string[] = [];

  if (dashboard.title != null && dashboard.title !== '') {
    parts.push(`The panel is part of a dashboard with the title: ${dashboard.title}`);
  }
  if (dashboard.description != null && dashboard.description !== '') {
    parts.push(`The panel is part of a dashboard with the description: ${dashboard.description}`);
  }
  parts.push(`This is the JSON which defines the panel: ${panelString}`);

  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: parts.join('\n'),
      role: Role.user,
    },
  ];
}
