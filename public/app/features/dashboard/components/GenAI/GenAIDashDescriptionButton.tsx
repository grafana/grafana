import React from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import { getDashboardPanelPrompt, Message, Role } from './utils';

interface GenAIDashDescriptionButtonProps {
  onGenerate: (description: string) => void;
  dashboard: DashboardModel;
}

const DASHBOARD_DESCRIPTION_CHAR_LIMIT = 300;

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Dashboards.\n' +
  'Your goal is to write a descriptive and concise dashboard description.\n' +
  "You will be given the title and description of the dashboard's panels.\n" +
  'The dashboard description is meant to explain the purpose of the dashboard and what its panels show.\n' +
  'If the dashboard has no panels, the description should be "Empty dashboard"\n' +
  'There should be no numbers in the description except where they are important.\n' +
  'The dashboard description should not have the dashboard title or any quotation marks in it.\n' +
  `The description should be, at most, ${DASHBOARD_DESCRIPTION_CHAR_LIMIT} characters.\n` +
  'Respond with only the description of the dashboard.';

export const GenAIDashDescriptionButton = ({ onGenerate, dashboard }: GenAIDashDescriptionButtonProps) => {
  const messages = React.useMemo(() => getMessages(dashboard), [dashboard]);

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.dashboardDescription}
      toggleTipTitle={'Improve your dashboard description'}
    />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  const panelPrompt = getDashboardPanelPrompt(dashboard);

  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The title of the dashboard is "${dashboard.title}"\n` + `${panelPrompt}`,
      role: Role.system,
    },
  ];
}
