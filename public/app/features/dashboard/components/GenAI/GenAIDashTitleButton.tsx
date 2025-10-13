import { getDashboardSrv } from '../../services/DashboardSrv';
import { DashboardModel } from '../../state/DashboardModel';

import { GenAIButton } from './GenAIButton';
import { EventTrackingSrc } from './tracking';
import {
  DASHBOARD_NEED_PANEL_TITLES_AND_DESCRIPTIONS_MESSAGE,
  getDashboardPanelPrompt,
  getPanelStrings,
  Message,
  Role,
} from './utils';

interface GenAIDashTitleButtonProps {
  onGenerate: (description: string) => void;
}

const DASH_TITLE_CHAR_LIMIT = 50;

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Dashboards.\n' +
  'Your goal is to write a concise dashboard title.\n' +
  "You will be given the title and description of the dashboard's panels.\n" +
  'The dashboard title is meant to say what it shows on one line for users to navigate to it.\n' +
  'If the dashboard has no panels, the title should be "Empty dashboard"\n' +
  'There should be no numbers in the title.\n' +
  'The dashboard title should not have quotation marks in it.\n' +
  `The title should be, at most, ${DASH_TITLE_CHAR_LIMIT} characters.\n` +
  'Respond with only the title of the dashboard.';

export const GenAIDashTitleButton = ({ onGenerate }: GenAIDashTitleButtonProps) => {
  const dashboard = getDashboardSrv().getCurrent()!;
  const panelStrings = getPanelStrings(dashboard);

  return (
    <GenAIButton
      messages={getMessages(dashboard)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.dashboardTitle}
      toggleTipTitle={'Improve your dashboard title'}
      disabled={panelStrings.length === 0}
      tooltip={panelStrings.length === 0 ? DASHBOARD_NEED_PANEL_TITLES_AND_DESCRIPTIONS_MESSAGE : undefined}
    />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  return [
    {
      content: TITLE_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The panels in the dashboard are: ${getDashboardPanelPrompt(dashboard)}`,
      role: Role.user,
    },
  ];
}
