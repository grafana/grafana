import React, { useState } from 'react';

import { arrayUtils } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';
import { DashboardLinkList } from 'app/features/dashboard-scene/settings/links/DashboardLinkList';

import { DashboardModel } from '../../state/DashboardModel';

type LinkSettingsListProps = {
  dashboard: DashboardModel;
  onNew: () => void;
  onEdit: (idx: number) => void;
};

/**
 * Used in DashboardSettings to display the list of links.
 * It updates the DashboardModel instance when links are added, edited, duplicated or deleted.
 */
export const LinkSettingsList = ({ dashboard, onNew, onEdit }: LinkSettingsListProps) => {
  const [links, setLinks] = useState(dashboard.links);

  const moveLink = (idx: number, direction: number) => {
    dashboard.links = arrayUtils.moveItemImmutably(links, idx, idx + direction);
    setLinks(dashboard.links);
  };

  const duplicateLink = (link: DashboardLink) => {
    dashboard.links = [...links, { ...link }];
    setLinks(dashboard.links);
  };

  const deleteLink = (idx: number) => {
    dashboard.links = [...links.slice(0, idx), ...links.slice(idx + 1)];
    setLinks(dashboard.links);
  };

  return (
    <DashboardLinkList
      links={links}
      onNew={onNew}
      onEdit={onEdit}
      onDuplicate={duplicateLink}
      onDelete={deleteLink}
      onOrderChange={moveLink}
    />
  );
};
