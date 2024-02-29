import React, { useContext, useEffect, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import { ModalsContext, Button, Dropdown, Icon } from '@grafana/ui';

import { useQueryParams } from '../../../../../core/hooks/useQueryParams';
import { Trans } from '../../../../../core/internationalization';
import { DashboardInteractions } from '../../../../dashboard-scene/utils/interactions';
import { DashboardModel } from '../../../state';
import { ShareModal } from '../../ShareModal';

import { ShareMenu } from './ShareMenu';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <Dropdown
      overlay={() => <ShareMenu dashboard={dashboard} />}
      placement="bottom-start"
      onVisibleChange={setIsMenuOpen}
    >
      <Button
        data-testid={e2eSelectors.pages.Dashboard.DashNav.shareButton}
        variant="primary"
        size="sm"
        onClick={() => {
          DashboardInteractions.toolbarShareClick();
          locationService.partial({ shareView: 'link' });
        }}
      >
        <Trans i18nKey="dashboard.toolbar.share-button">Share</Trans>
        <Icon name={isMenuOpen ? 'angle-up' : 'angle-down'} size="lg" />
      </Button>
    </Dropdown>
  );
};
