import React from 'react';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { Message, Role } from './utils';

interface GenAIPanelDescriptionButtonProps {
  onGenerate: (description: string, isDone: boolean) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  panel: PanelModel;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel description using a JSON object with the panel declaration ' +
  'The description should be shorter than 140 characters.';

export const GenAIPanelDescriptionButton = ({ onClick, onGenerate, panel }: GenAIPanelDescriptionButtonProps) => {
  const messages = React.useMemo(() => getMessages(panel), [panel]);

  return (
    <GenAIButton messages={messages} onClick={onClick} onGenerate={onGenerate} loadingText={'Generating description'} />
  );
};

function getMessages(panel: PanelModel): Message[] {
  const dashboard = getDashboardSrv().getCurrent()!;

  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
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
