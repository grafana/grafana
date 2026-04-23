import { useCallback, useContext } from 'react';
import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { ModalsContext } from '@grafana/ui';

import { SaveBeforeShareModal } from '../../../sharing/SaveBeforeShareModal';
import ShareMenu from '../../../sharing/ShareButton/ShareMenu';
import { buildShareUrl } from '../../../sharing/ShareButton/utils';
import { DashboardInteractions } from '../../../utils/interactions';
import { type ToolbarActionProps } from '../types';

import { ShareExportDashboardButton } from './ShareExportDashboardButton';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;

export const ShareDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const { showModal, hideModal } = useContext(ModalsContext);

  const [{ loading }, buildUrl] = useAsyncFn(async () => {
    DashboardInteractions.toolbarShareClick();
    await buildShareUrl(dashboard);
  }, [dashboard]);

  const onPrimaryShareClick = useCallback(() => {
    if (dashboard.state.isEditing && dashboard.state.isDirty) {
      showModal(SaveBeforeShareModal, { dashboard, onContinue: buildUrl, onDismiss: hideModal });
      return;
    }

    buildUrl();
  }, [buildUrl, dashboard, hideModal, showModal]);

  return (
    <ShareExportDashboardButton
      menu={() => <ShareMenu dashboard={dashboard} />}
      onMenuVisibilityChange={(isOpen) => {
        if (isOpen) {
          DashboardInteractions.toolbarShareDropdownClick();
        }
      }}
      groupTestId={newShareButtonSelector.shareLink}
      buttonTooltip={t('dashboard.toolbar.new.share.tooltip', 'Copy link')}
      buttonTestId={newShareButtonSelector.container}
      onButtonClick={onPrimaryShareClick}
      arrowLabel={t('dashboard.toolbar.new.share.arrow', 'Share')}
      arrowTestId={newShareButtonSelector.arrowMenu}
      dashboard={dashboard}
      loading={loading}
    />
  );
};
