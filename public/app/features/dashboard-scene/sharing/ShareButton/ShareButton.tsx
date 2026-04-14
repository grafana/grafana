import { useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { ButtonGroup, Dropdown, ToolbarButton } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import ShareMenu from './ShareMenu';
import { buildShareUrl } from './utils';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;

export default function ShareButton({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const [isOpen, setIsOpen] = useState(false);

  const [{ loading }, buildUrl] = useAsyncFn(async () => {
    DashboardInteractions.toolbarShareClick();
    await buildShareUrl(dashboard, panel);
  }, [dashboard, panel]);

  const onMenuClick = useCallback((isOpen: boolean) => {
    if (isOpen) {
      DashboardInteractions.toolbarShareDropdownClick();
    }

    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ShareMenu dashboard={dashboard} />;

  return (
    <ButtonGroup data-testid={newShareButtonSelector.container}>
      <ToolbarButton
        data-testid={newShareButtonSelector.shareLink}
        tooltip={t('share-dashboard.share-button-tooltip', 'Copy link')}
        onClick={loading ? undefined : buildUrl}
        icon={loading ? 'spinner' : 'share-alt'}
      >
        <Trans i18nKey="share-dashboard.share-button">Share</Trans>
      </ToolbarButton>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <ToolbarButton
          aria-label={t('dashboard-scene.share-button.aria-label-sharedropdownmenu', 'Toggle share menu')}
          data-testid={newShareButtonSelector.arrowMenu}
          icon={isOpen ? 'angle-up' : 'angle-down'}
        />
      </Dropdown>
    </ButtonGroup>
  );
}
