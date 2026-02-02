// BMC File
// Co Authored by : kchidrawar, ymulthan
import { FC } from 'react';

import { Page } from 'app/core/components/Page/Page';

import { SettingsPageProps } from '../dashboard/components/DashboardSettings/types';

import { LocaleKeyManagement } from './LocaleKeyManagement';

const LocaleSettings: FC<SettingsPageProps> = ({ dashboard, sectionNav }) => {
  const pageNav = sectionNav.node.parentItem;

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      <LocaleKeyManagement dashboard={dashboard} globalMode={false} defaultKey="default" />
    </Page>
  );
};

export default LocaleSettings;
