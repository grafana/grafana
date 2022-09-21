import React, { useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/PageNew/Page';

import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';
import { newLink } from '../LinksSettings/LinkSettingsEdit';

import { SettingsPageProps } from './types';

export type LinkSettingsMode = 'list' | 'new' | 'edit';

export function LinksSettings({ dashboard, sectionNav, editIndex }: SettingsPageProps) {
  const [isNew, setIsNew] = useState<boolean>(false);

  const onGoBack = () => {
    locationService.partial({ editIndex: undefined });
    setIsNew(false);
  };

  const onNew = () => {
    dashboard.links = [...dashboard.links, { ...newLink }];
    locationService.partial({ editIndex: dashboard.links.length - 1 });
    setIsNew(true);
  };

  const onEdit = (idx: number) => {
    locationService.partial({ editIndex: idx });
    setIsNew(false);
  };

  const isEditing = editIndex !== undefined;

  let pageNav: NavModelItem | undefined;
  if (isEditing) {
    const title = isNew ? 'New link' : 'Edit link';
    const description = isNew ? 'Create a new link on your dashboard' : 'Edit a specific link of your dashboard';
    pageNav = {
      text: title,
      subTitle: description,
    };
  }

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      {!isEditing && <LinkSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <LinkSettingsEdit dashboard={dashboard} editLinkIdx={editIndex!} onGoBack={onGoBack} />}
    </Page>
  );
}
