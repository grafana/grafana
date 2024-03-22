import React from 'react';

import { getDashboardSrv } from '../../services/DashboardSrv';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import { getDashboardPanelPrompt, Message, Role } from './utils';

interface GenAIDashDescriptionButtonProps {
  onGenerate: (description: string) => void;
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

export const GenAIDashDescriptionButton = ({ onGenerate }: GenAIDashDescriptionButtonProps) => {
  return (
    <GenAIButton
      messages={getMessages}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.dashboardDescription}
      toggleTipTitle={'Improve your dashboard description'}
    />
  );
};

function getMessages(): Message[] {
  const dashboard = getDashboardSrv().getCurrent()!;
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
