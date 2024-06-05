import { Dashboard, Panel } from '@grafana/schema';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import { Message, Role, getFilteredPanelString } from './utils';

interface GenAIPanelTitleButtonProps {
  onGenerate: (title: string) => void;
  panel: Panel;
  dashboard: Dashboard;
}

const PANEL_TITLE_CHAR_LIMIT = 50;

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel title.' +
  `The title should be shorter than ${PANEL_TITLE_CHAR_LIMIT} characters.`;

export const GenAIPanelTitleButton = ({ onGenerate, panel, dashboard }: GenAIPanelTitleButtonProps) => {
  return (
    <GenAIButton
      messages={() => getMessages(panel, dashboard)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.panelTitle}
      toggleTipTitle={'Improve your panel title'}
    />
  );
};

function getMessages(panel: Panel, dashboard: Dashboard): Message[] {
  const panelString = getFilteredPanelString(panel);

  return [
    {
      content: TITLE_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content:
        `The panel is part of a dashboard with the title: ${dashboard.title}\n` +
        `The panel is part of a dashboard with the description: ${dashboard.description}\n` +
        `Use this JSON object which defines the panel: ${panelString}`,
      role: Role.user,
    },
  ];
}
