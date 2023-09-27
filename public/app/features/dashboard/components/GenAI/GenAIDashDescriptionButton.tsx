import React from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { Message, Role } from './utils';

interface GenAIDashDescriptionButtonProps {
  onGenerate: (description: string) => void;
  dashboard: DashboardModel;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Dashboards.\n' +
  'Your goal is to write a descriptive and concise dashboard description.\n' +
  "You will be given the title and description of the dashboard's panels.\n" +
  'The dashboard description is meant to explain the purpose of the dashboard and what it shows.\n' +
  'There should be no numbers in the description except where they are important.\n' +
  'The description should be, at most, 140 characters.';

export const GenAIDashDescriptionButton = ({ onGenerate, dashboard }: GenAIDashDescriptionButtonProps) => {
  const messages = React.useMemo(() => getMessages(dashboard), [dashboard]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.dashboardDescription), []);

  return (
    <GenAIButton messages={messages} onGenerate={onGenerate} onClick={onClick} loadingText={'Generating description'} />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  const panels: string[] = dashboard.panels.map(
    (panel, idx) => `
      - Panel ${idx}\n
      - Title: ${panel.title}\n
      ${panel.description ? `- Description: ${panel.description}` : ''}
      `
  );
  let panelString: string;
  if (panels.length <= 10) {
    panelString = `The the panels in the dashboard are:\n${panels.join('\n')}`;
  } else {
    panelString = `There are ${panels.length} panels.\n
    Due to space constraints, only the information for the first ten are how is presented.\n
    The the panels in the dashboard are:\n${panels.slice(10).join('\n')}`;
  } // This truncation should prevent exceeding the allowed size for GPT calls.
  // Additionally, context windows that are too long degrade performance,
  // So it is possibly that if we can condense it further it would be better

  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The title of the dashboard is "${dashboard.title}"\n
      ${panelString}`,
      role: Role.system,
    },
  ];
}
