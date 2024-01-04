import React, { useState } from 'react';

import { DashboardLink } from '@grafana/schema';

import { DashboardModel } from '../../state/DashboardModel';

import { DashboardLinkForm } from './DashboardLinkForm';
import { newLink } from './utils';

type LinkSettingsEditProps = {
  editLinkIdx: number;
  dashboard: DashboardModel;
  onGoBack: () => void;
};

export const LinkSettingsEdit = ({ editLinkIdx, dashboard, onGoBack }: LinkSettingsEditProps) => {
  const [linkSettings, setLinkSettings] = useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : newLink);

  const onUpdate = (link: DashboardLink) => {
    const links = [...dashboard.links];
    links.splice(editLinkIdx, 1, link);
    dashboard.links = links;
    setLinkSettings(link);
  };

  return <DashboardLinkForm link={linkSettings} onUpdate={onUpdate} onGoBack={onGoBack} />;
};
