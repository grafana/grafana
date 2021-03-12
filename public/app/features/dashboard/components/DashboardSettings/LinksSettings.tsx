import React, { useState } from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import { LinkSettingsEdit, LinkSettingsHeader, LinkSettingsList } from '../LinksSettings';
interface Props {
  dashboard: DashboardModel;
}

export type LinkSettingsMode = 'list' | 'new' | 'edit';

export const LinksSettings: React.FC<Props> = ({ dashboard }) => {
  const [mode, setMode] = useState<LinkSettingsMode>('list');
  const [editLinkIdx, setEditLinkIdx] = useState<number | null>(null);
  const hasLinks = dashboard.links.length > 0;

  const onGoBack = () => {
    setMode('list');
  };
  const onNew = () => {
    setEditLinkIdx(null);
    setMode('new');
  };
  const onEdit = (idx: number) => {
    setEditLinkIdx(idx);
    setMode('edit');
  };

  return (
    <>
      <LinkSettingsHeader onNavClick={onGoBack} onNew={onNew} mode={mode} hasLinks={hasLinks} />
      {mode === 'list' ? (
        <LinkSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />
      ) : (
        <LinkSettingsEdit dashboard={dashboard} mode={mode} editLinkIdx={editLinkIdx} onGoBack={onGoBack} />
      )}
    </>
  );
};
