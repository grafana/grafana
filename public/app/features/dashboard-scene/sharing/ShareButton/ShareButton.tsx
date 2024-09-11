import { useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { VizPanel } from '@grafana/scenes';
import { Button, ButtonGroup, Dropdown } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import ShareMenu from './ShareMenu';
import { buildShareUrl } from './utils';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;

export default function ShareButton({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const [isOpen, setIsOpen] = useState(false);

  const [_, buildUrl] = useAsyncFn(async () => {
    return await buildShareUrl(dashboard, panel);
  }, [dashboard]);

  const onMenuClick = useCallback((isOpen: boolean) => {
    if (isOpen) {
      DashboardInteractions.toolbarShareClick();
    }

    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ShareMenu dashboard={dashboard} />;

  return (
    <ButtonGroup data-testid={newShareButtonSelector.container}>
      <Button
        data-testid={newShareButtonSelector.shareLink}
        size="sm"
        tooltip={t('share-dashboard.share-button-tooltip', 'Copy shortened link')}
        onClick={buildUrl}
      >
        <Trans i18nKey="share-dashboard.share-button">Share</Trans>
      </Button>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button data-testid={newShareButtonSelector.arrowMenu} size="sm" icon={isOpen ? 'angle-up' : 'angle-down'} />
      </Dropdown>
    </ButtonGroup>
  );
}
