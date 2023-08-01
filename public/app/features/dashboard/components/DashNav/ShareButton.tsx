import React, { useContext, useEffect } from 'react';

import { ModalsContext } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';

import { ShareModal } from '../ShareModal';

import { DashNavButton } from './DashNavButton';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  const [queryParams] = useQueryParams();
  const { showModal, hideModal } = useContext(ModalsContext);

  useEffect(() => {
    if (!!queryParams.shareView) {
      showModal(ShareModal, {
        dashboard,
        onDismiss: hideModal,
        activeTab: String(queryParams.shareView),
      });
    }
    return () => {
      hideModal();
    };
  }, [showModal, hideModal, dashboard, queryParams.shareView]);

  return (
    <DashNavButton
      tooltip={t('dashboard.toolbar.share', 'Share dashboard or panel')}
      icon="share-alt"
      iconSize="lg"
      onClick={() => {
        showModal(ShareModal, {
          dashboard,
          onDismiss: hideModal,
        });
      }}
    />
  );
};
