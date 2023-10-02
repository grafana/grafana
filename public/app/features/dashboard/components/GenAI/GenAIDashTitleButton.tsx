import React from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { getDashboardPanelPrompt, Message, Role } from './utils';

interface GenAIDashTitleButtonProps {
  dashboard: DashboardModel;
  onGenerate: (description: string) => void;
}

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Dashboards.\n' +
  'Your goal is to write a concise dashboard title.\n' +
  "You will be given the title and description of the dashboard's panels.\n" +
  'The dashboard title is meant to say what it shows on one line for users to navigate to it.\n' +
  'If the dashboard has no panels, the title should be "Empty dashboard"\n' +
  'There should be no numbers in the title.\n' +
  'The dashboard title should not have quotation marks in it.\n' +
  'The title should be, at most, 50 characters.\n' +
  'Respond with only the title of the dashboard.';

export const GenAIDashTitleButton = ({ onGenerate, dashboard }: GenAIDashTitleButtonProps) => {
  const messages = React.useMemo(() => getMessages(dashboard), [dashboard]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.dashboardTitle), []);

  return <GenAIButton messages={messages} onClick={onClick} onGenerate={onGenerate} loadingText={'Generating title'} />;
};

function getMessages(dashboard: DashboardModel): Message[] {
  return [
    {
      content: TITLE_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The panels in the dashboard are: ${getDashboardPanelPrompt(dashboard)}`,
      role: Role.system,
    },
  ];
}
