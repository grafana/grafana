import React, { useState } from 'react';

import { DashboardLink } from '@grafana/schema';
import { DashboardLinkForm } from 'app/features/dashboard-scene/settings/links/DashboardLinkForm';
import { NEW_LINK } from 'app/features/dashboard-scene/settings/links/utils';

import { DashboardModel } from '../../state/DashboardModel';

type LinkSettingsEditProps = {
  editLinkIdx: number;
  dashboard: DashboardModel;
  onGoBack: () => void;
};

export const LinkSettingsEdit = ({ editLinkIdx, dashboard, onGoBack }: LinkSettingsEditProps) => {
  const [linkSettings, setLinkSettings] = useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : NEW_LINK);

  const onUpdate = (link: DashboardLink) => {
    const links = [...dashboard.links];
    links.splice(editLinkIdx, 1, link);
    dashboard.links = links;
    setLinkSettings(link);
  };

  return <DashboardLinkForm link={linkSettings} onUpdate={onUpdate} onGoBack={onGoBack} />;
};
