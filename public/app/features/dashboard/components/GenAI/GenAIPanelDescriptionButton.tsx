import React from 'react';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventSource, reportGenerateAIButtonClicked } from './tracking';
import { Message, Role } from './utils';

interface GenAIPanelDescriptionButtonProps {
  onGenerate: (description: string) => void;
  panel: PanelModel;
}

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.\n' +
  'You will be given the title and description of the dashboard the panel is in as well as the JSON for the panel.\n' +
  'Your goal is to write a descriptive and concise panel description.\n' +
  'The panel description is meant to explain the purpose of the panel, not just its attributes.\n' +
  'There should be no numbers in the description except for thresholds.\n' +
  'The description should be, at most, 140 characters.';

export const GenAIPanelDescriptionButton = ({ onGenerate, panel }: GenAIPanelDescriptionButtonProps) => {
  const messages = React.useMemo(() => getMessages(panel), [panel]);
  const onClick = React.useCallback(() => reportGenerateAIButtonClicked(EventSource.panelDescription), []);

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
      content: `This is the JSON which defines the panel: ${JSON.stringify(panel.getSaveModel())}`,
      role: Role.user,
    },
  ];
}
