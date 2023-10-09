import React from 'react';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import { Message, QuickFeedbackType, Role } from './utils';

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

  return (
    <GenAIButton
      messages={messages}
      onGenerate={onGenerate}
      loadingText={'Generating title'}
      eventTrackingSrc={EventTrackingSrc.panelTitle}
      toggleTipTitle={'Improve your panel title'}
    />
  );
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

export const getFeedbackMessage = (previousResponse: string, feedback: string | QuickFeedbackType): Message[] => {
  return [
    {
      role: Role.system,
      content: `Your previous response was: ${previousResponse}. The user has provided the following feedback: ${feedback}. Re-generate your response according to the provided feedback.`,
    },
  ];
};
