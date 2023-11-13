import React, { useContext, useEffect } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { ModalsContext, Button } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { DashboardModel } from 'app/features/dashboard/state';

import { ShareModal } from '../ShareModal';

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
    <Button
      data-testid={e2eSelectors.pages.Dashboard.DashNav.shareButton}
      variant="primary"
      size="sm"
      onClick={() => {
        showModal(ShareModal, {
          dashboard,
          onDismiss: hideModal,
        });
      }}
    >
      {/*TODO: this key is being use by scenes tooltip, check with them if we can change it to Share instead of Share dashboard*/}
      {/*<Trans i18nKey="dashboard.toolbar.share">Share</Trans>*/}
      Share
    </Button>
  );
};
