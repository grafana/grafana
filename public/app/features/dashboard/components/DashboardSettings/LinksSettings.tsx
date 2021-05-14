import React, { useState } from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';
import { newLink } from '../LinksSettings/LinkSettingsEdit';
import { DashboardSettingsHeader } from './DashboardSettingsHeader';
interface Props {
  dashboard: DashboardModel;
}

export type LinkSettingsMode = 'list' | 'new' | 'edit';

export const LinksSettings: React.FC<Props> = ({ dashboard }) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const onGoBack = () => {
    setEditIdx(null);
  };

  const onNew = () => {
    dashboard.links = [...dashboard.links, { ...newLink }];
    setEditIdx(dashboard.links.length - 1);
  };

  const onEdit = (idx: number) => {
    setEditIdx(idx);
  };

  const isEditing = editIdx !== null;

  return (
    <>
      <DashboardSettingsHeader onGoBack={onGoBack} title="Dashboard links" isEditing={isEditing} />
      {!isEditing && <LinkSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <LinkSettingsEdit dashboard={dashboard} editLinkIdx={editIdx!} onGoBack={onGoBack} />}
    </>
  );
};
