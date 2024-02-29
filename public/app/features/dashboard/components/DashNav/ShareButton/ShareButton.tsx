import React, { useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, Dropdown, Icon } from '@grafana/ui';

import { Trans } from '../../../../../core/internationalization';
import { DashboardInteractions } from '../../../../dashboard-scene/utils/interactions';
import { DashboardModel } from '../../../state';

import { ShareMenu } from './ShareMenu';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
        }}
      >
        <Trans i18nKey="dashboard.toolbar.share-button">Share</Trans>
        <Icon name={isMenuOpen ? 'angle-up' : 'angle-down'} size="lg" />
      </Button>
    </Dropdown>
  );
};
