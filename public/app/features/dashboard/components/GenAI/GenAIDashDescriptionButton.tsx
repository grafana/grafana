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

interface GenAIDashDescriptionButtonProps {
  onGenerate: (description: string) => void;
}

const DASHBOARD_DESCRIPTION_CHAR_LIMIT = 300;

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Dashboards.\n' +
  'Your goal is to write a descriptive and concise dashboard description.\n' +
  "You will be given the title and description of the dashboard's panels.\n" +
  'The dashboard description is meant to explain the purpose of the dashboard and what its panels show.\n' +
  'If the dashboard has no panels, the description should be "Empty dashboard"\n' +
  'There should be no numbers in the description except where they are important.\n' +
  'The dashboard description should not have the dashboard title or any quotation marks in it.\n' +
  `The description should be, at most, ${DASHBOARD_DESCRIPTION_CHAR_LIMIT} characters.\n` +
  'Respond with only the description of the dashboard.';

export const GenAIDashDescriptionButton = ({ onGenerate }: GenAIDashDescriptionButtonProps) => {
  const dashboard = getDashboardSrv().getCurrent()!;
  const panelStrings = getPanelStrings(dashboard);

  return (
    <GenAIButton
      messages={getMessages(dashboard)}
      onGenerate={onGenerate}
      eventTrackingSrc={EventTrackingSrc.dashboardDescription}
      toggleTipTitle={'Improve your dashboard description'}
      disabled={panelStrings.length === 0}
      tooltip={panelStrings.length === 0 ? DASHBOARD_NEED_PANEL_TITLES_AND_DESCRIPTIONS_MESSAGE : undefined}
    />
  );
};

function getMessages(dashboard: DashboardModel): Message[] {
  return [
    {
      content: DESCRIPTION_GENERATION_STANDARD_PROMPT,
      role: Role.system,
    },
    {
      content: `The title of the dashboard is "${dashboard.title}"\n` + `${getDashboardPanelPrompt(dashboard)}`,
      role: Role.user,
    },
  ];
}
