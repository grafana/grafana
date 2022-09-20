import React, { useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/PageNew/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';
import { newLink } from '../LinksSettings/LinkSettingsEdit';

import { SettingsPageProps } from './types';

export type LinkSettingsMode = 'list' | 'new' | 'edit';

export function LinksSettings({ dashboard, sectionNav }: SettingsPageProps) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const { chrome } = useGrafana();

  React.useEffect(() => {
    if (sectionNav) {
      chrome.update({
        sectionNav: sectionNav.node,
      });
    }
  }, [sectionNav, chrome]);

  const onGoBack = () => {
    setEditIdx(null);
    setIsNew(false);
  };

  const onNew = () => {
    dashboard.links = [...dashboard.links, { ...newLink }];
    setEditIdx(dashboard.links.length - 1);
    setIsNew(true);
  };

  const onEdit = (idx: number) => {
    setEditIdx(idx);
    setIsNew(false);
  };

  const isEditing = editIdx !== null;

  let pageNav: NavModelItem | undefined;
  if (isEditing) {
    const title = isNew ? 'New link' : 'Edit link';
    pageNav = {
      text: title,
      subTitle: 'Manage a specific link',
    };
  }

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      {!isEditing && <LinkSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <LinkSettingsEdit dashboard={dashboard} editLinkIdx={editIdx!} onGoBack={onGoBack} />}
    </Page>
  );
}
