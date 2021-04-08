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

  const backToList = () => {
    setMode('list');
  };
  const setupNew = () => {
    setEditLinkIdx(null);
    setMode('new');
  };
  const editLink = (idx: number) => {
    setEditLinkIdx(idx);
    setMode('edit');
  };

  return (
    <>
      <LinkSettingsHeader onNavClick={backToList} onBtnClick={setupNew} mode={mode} hasLinks={hasLinks} />
      {mode === 'list' ? (
        <LinkSettingsList dashboard={dashboard} setupNew={setupNew} editLink={editLink} />
      ) : (
        <LinkSettingsEdit dashboard={dashboard} mode={mode} editLinkIdx={editLinkIdx} backToList={backToList} />
      )}
    </>
  );
};
