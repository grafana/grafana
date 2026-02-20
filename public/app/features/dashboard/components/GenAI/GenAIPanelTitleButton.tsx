import { PanelData } from '@grafana/data';
import { Dashboard, Panel } from '@grafana/schema';

import { GenAIButton } from './GenAIButton';
import { useGenerationProvider } from './hooks';
import { EventTrackingSrc } from './tracking';
import { Message, Role, getFilteredPanelString } from './utils';

interface GenAIPanelTitleButtonProps {
  onGenerate: (title: string) => void;
  panel: Panel;
  dashboard: Dashboard;
  data?: PanelData;
}

const PANEL_TITLE_CHAR_LIMIT = 50;

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel title.' +
  `The title should be shorter than ${PANEL_TITLE_CHAR_LIMIT} characters.`;

export const GenAIPanelTitleButton = ({ onGenerate, panel, dashboard, data }: GenAIPanelTitleButtonProps) => {
  const { provider, isLoading } = useGenerationProvider();

  // When assistant is available, AITextInput handles generation directly - no addon button needed
  if (isLoading || provider === 'none' || provider === 'assistant') {
    return null;
  }

  return (
    <GenAIButton
      messages={() => getLLMMessages(panel, dashboard)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.panelTitle}
      toggleTipTitle={'Improve your panel title'}
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
  parts.push(`Use this JSON object which defines the panel: ${panelString}`);

  return [
    {
      content: TITLE_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: parts.join('\n'),
      role: Role.user,
    },
  ];
}
