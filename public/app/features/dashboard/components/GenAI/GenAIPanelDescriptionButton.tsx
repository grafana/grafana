import { Panel } from '@grafana/schema';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import { Message, Role, getFilteredPanelString } from './utils';

interface GenAIPanelDescriptionButtonProps {
  onGenerate: (description: string) => void;
  panel: Panel;
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

export const GenAIPanelDescriptionButton = ({ onGenerate, panel }: GenAIPanelDescriptionButtonProps) => {
  return (
    <GenAIButton
      messages={() => getMessages(panel)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.panelDescription}
      toggleTipTitle={'Improve your panel description'}
    />
  );
};

function getMessages(panel: Panel): Message[] {
  const dashboard = getDashboardSrv().getCurrent()!;
  const panelString = getFilteredPanelString(panel);

  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content:
        `The panel is part of a dashboard with the title: ${dashboard.title}\n` +
        `The panel is part of a dashboard with the description: ${dashboard.description}\n` +
        `This is the JSON which defines the panel: ${panelString}`,
      role: Role.user,
    },
  ];
}
