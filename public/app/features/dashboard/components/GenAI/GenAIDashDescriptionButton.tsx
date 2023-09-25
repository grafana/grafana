import React from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { Message, Role } from './utils';

interface GenAIDashDescriptionButtonProps {
  onGenerate: (description: string, isDone: boolean) => void;
  dashboard: DashboardModel;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in Grafana dashboards.' +
  'Your goal is to write short, descriptive, and concise dashboards description using the dashboard panels title and descriptions. ' +
  'The description should be shorter than 140 characters.';

export const GenAIDashDescriptionButton = ({ onGenerate, dashboard }: GenAIDashDescriptionButtonProps) => {
  const messages = React.useMemo(() => getMessages(dashboard), [dashboard]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.dashboardDescription), []);

  return (
    <GenAIButton messages={messages} onGenerate={onGenerate} onClick={onClick} loadingText={'Generating description'} />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The title of the dashboard is "${
        dashboard.title
      }" and the the panels in the dashboard are: ${dashboard.panels
        .map(
          (panel, idx) => `
            - Panel ${idx}
              - Title: ${panel.title}
              ${panel.description ? `- Description: ${panel.description}` : ''}
              `
        )
        .join('\n')}`,
      role: Role.system,
    },
  ];
}
