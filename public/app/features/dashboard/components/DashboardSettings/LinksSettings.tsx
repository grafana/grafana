import { useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { NEW_LINK } from 'app/features/dashboard-scene/settings/links/utils';

import { LinkSettingsEdit, LinkSettingsList } from '../LinksSettings';

import { SettingsPageProps } from './types';

export type LinkSettingsMode = 'list' | 'new' | 'edit';

export function LinksSettings({ dashboard, sectionNav, editIndex }: SettingsPageProps) {
  const [isNew, setIsNew] = useState<boolean>(false);

  const onGoBack = () => {
    setIsNew(false);
    locationService.partial({ editIndex: undefined });
  };

  const onNew = () => {
    dashboard.links = [...dashboard.links, { ...NEW_LINK }];
    setIsNew(true);
    locationService.partial({ editIndex: dashboard.links.length - 1 });
  };

  const onEdit = (idx: number) => {
    setIsNew(false);
    locationService.partial({ editIndex: idx });
  };

  const isEditing = editIndex !== undefined;

  let pageNav = sectionNav.node.parentItem;

  /*BMC Change using t or Trans : To enable localization for below text*/

  if (isEditing) {
    const title = isNew
      ? `${t('bmcgrafana.dashboards.settings.links..title-new-link', 'New link')}`
      : `${t('bmcgrafana.dashboards.settings.links.title-edit-link', 'Edit link')}`;
    const description = isNew
      ? `${t('cdescription-new-link', 'Create a new link on your dashboard')}`
      : `${t('bmcgrafana.dashboards.settings.links.description-edit-link', 'Edit a specific link of your dashboard')}`;
    pageNav = {
      text: title,
      subTitle: description,
      parentItem: sectionNav.node.parentItem,
    };
  }

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      {!isEditing && <LinkSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <LinkSettingsEdit dashboard={dashboard} editLinkIdx={editIndex} onGoBack={onGoBack} />}
    </Page>
  );
}
