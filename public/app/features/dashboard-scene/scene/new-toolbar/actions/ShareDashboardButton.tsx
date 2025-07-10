import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import ShareMenu from '../../../sharing/ShareButton/ShareMenu';
import { buildShareUrl } from '../../../sharing/ShareButton/utils';
import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

import { ShareExportDashboardButton } from './ShareExportDashboardButton';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;

export const ShareDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const [_, buildUrl] = useAsyncFn(async () => {
    DashboardInteractions.toolbarShareClick();
    await buildShareUrl(dashboard);
  }, [dashboard]);

  return (
    <ShareExportDashboardButton
      menu={() => <ShareMenu dashboard={dashboard} />}
      onMenuVisibilityChange={(isOpen) => {
        if (isOpen) {
          DashboardInteractions.toolbarShareDropdownClick();
        }
      }}
      groupTestId={newShareButtonSelector.shareLink}
      buttonLabel={t('dashboard.toolbar.new.share.title', 'Share')}
      buttonTooltip={t('dashboard.toolbar.new.share.tooltip', 'Copy link')}
      buttonTestId={newShareButtonSelector.container}
      onButtonClick={buildUrl}
      arrowLabel={t('dashboard.toolbar.new.share.arrow', 'Share')}
      arrowTestId={newShareButtonSelector.arrowMenu}
      dashboard={dashboard}
      variant={!dashboard.state.isEditing ? 'primary' : 'secondary'}
    />
  );
};
