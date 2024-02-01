import React from 'react';

import { locationService } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashNavButton } from './DashNavButton';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  return (
    <DashNavButton
      tooltip={t('dashboard.toolbar.share', 'Share dashboard')}
      icon="share-alt"
      iconSize="lg"
      onClick={() => {
        DashboardInteractions.toolbarShareClick();
        locationService.partial({ shareView: 'link' });
      }}
    />
  );
};
