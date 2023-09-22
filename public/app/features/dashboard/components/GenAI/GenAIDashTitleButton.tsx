import React from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { Message, Role } from './utils';

interface GenAIDashTitleButtonProps {
  dashboard: DashboardModel;
  onGenerate: (description: string, isDone: boolean) => void;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in Grafana dashboards.' +
  'Your goal is to write the dashboard title inspired by the title and descriptions for the dashboard panels. ' +
  'The title must be shorter than 50 characters.';

export const GenAIDashTitleButton = ({ onGenerate, dashboard }: GenAIDashTitleButtonProps) => {
  const messages = React.useMemo(() => getMessages(dashboard), [dashboard]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.dashboardTitle), []);

  return <GenAIButton messages={messages} onClick={onClick} onGenerate={onGenerate} loadingText={'Generating title'} />;
};

function getMessages(dashboard: DashboardModel): Message[] {
  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The panels in the dashboard are: ${dashboard.panels
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
