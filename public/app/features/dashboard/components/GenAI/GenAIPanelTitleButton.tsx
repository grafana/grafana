import React from 'react';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { Message, Role } from './utils';

interface GenAIPanelTitleButtonProps {
  onGenerate: (title: string) => void;
  panel: PanelModel;
}

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel title for a panel.' +
  'The title should be shorter than 50 characters.';

export const GenAIPanelTitleButton = ({ onGenerate, panel }: GenAIPanelTitleButtonProps) => {
  const messages = React.useMemo(() => getMessages(panel), [panel]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.panelTitle), []);

  return <GenAIButton messages={messages} onClick={onClick} onGenerate={onGenerate} loadingText={'Generating title'} />;
};

function getMessages(panel: PanelModel): Message[] {
  const dashboard = getDashboardSrv().getCurrent()!;

  return [
    {
      content: TITLE_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The panel is part of a dashboard with the title: ${dashboard.title}`,
      role: Role.system,
    },
    {
      content: `The panel is part of a dashboard with the description: ${dashboard.title}`,
      role: Role.system,
    },
    {
      content: `Use this JSON object which defines the panel: ${JSON.stringify(panel.getSaveModel())}`,
      role: Role.user,
    },
  ];
}
