import { useEffect, useRef, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { shareDashboardType } from '../ShareModal/utils';

export const ShareButton = ({ dashboard }: { dashboard: DashboardModel }) => {
  // BMC Accessibility Change Start : When the share UI closes, restore focus to the trigger
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);
  const [queryParam] = useQueryParams();
  const [isDialogOpened, setIsDialogOpened] = useState(false);

  useEffect(() => {
    const isShareOpen = Boolean(queryParam.shareView);
    if (!isShareOpen && isDialogOpened) {
      shareButtonRef.current?.focus();
      setIsDialogOpened(false);
    }
  }, [queryParam.shareView, isDialogOpened]);
  // BMC Accessibility Change End
  return (
    <Button
      //BMC Accessibility Change next 1 line: Adding button ref
      ref={shareButtonRef}
      data-testid={e2eSelectors.pages.Dashboard.DashNav.shareButton}
      variant="primary"
      size="sm"
      onClick={() => {
        DashboardInteractions.toolbarShareClick();
        //BMC Accessibility Change next 1 line
        setIsDialogOpened(true);
        locationService.partial({ shareView: shareDashboardType.link });
      }}
    >
      <Trans i18nKey="dashboard.toolbar.share-button">Share</Trans>
    </Button>
  );
};
