import React, { useMemo } from 'react';

import { DashboardModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { getDashboardChanges, Message, Role } from './utils';

interface GenAIDashboardChangesButtonProps {
  dashboard: DashboardModel;
  onGenerate: (title: string) => void;
}

const CHANGES_GENERATION_STANDARD_PROMPT = [
  'You are an expert in Grafana Dashboards',
  'Your goal is to write a description of the changes for a dashboard',
  'When referring to panel changes, use the panel title',
  'When using panel title, wrap it with double quotes',
  'When the panel changes the position, just mention the panel title has changed position',
  'When an entire panel is added or removed, use the panel title and only say it was added or removed and disregard the rest of the changes for that panel',
  'Group changes when all panels are affected',
  'Do not mention line number',
  'Refer to templating elements as variables',
  'Ignore and never mention changes about plugin version',
  'Try to make it as short as possible.',
].join('. ');

export const GenAIDashboardChangesButton = ({ dashboard, onGenerate }: GenAIDashboardChangesButtonProps) => {
  const messages = useMemo(() => getMessages(dashboard), [dashboard]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.dashboardChanges), []);

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      onClick={onClick}
      loadingText={'Generating changes summary'}
      temperature={0}
    />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  const { userChanges, migrationChanges } = getDashboardChanges(dashboard);

  return [
    {
      content: CHANGES_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `This is the list of panel names, when referring to a panel, please use the title: ${JSON.stringify(
        dashboard.panels.map((panel) => panel.title)
      )}`,
      role: Role.system,
    },
    {
      content: `Group the following diff under "User changes" as a bullet list: ${JSON.stringify(userChanges)}`,
      role: Role.system,
    },
    {
      content: `Group the following diff under "Migration changes" as a bullet list: ${JSON.stringify(
        migrationChanges
      )}`,
      role: Role.system,
    },
  ];
}
