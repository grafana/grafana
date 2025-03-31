import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import ExportMenu from '../../../sharing/ExportButton/ExportMenu';
import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

import { ShareExportDashboardButton } from './ShareExportDashboardButton';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton;

export const ExportDashboardButton = ({ dashboard }: ToolbarActionProps) => (
  <ShareExportDashboardButton
    menu={() => <ExportMenu dashboard={dashboard} />}
    groupTestId={newExportButtonSelector.container}
    buttonLabel={t('dashboard.toolbar.new.export.title', 'Export')}
    buttonTooltip={t('dashboard.toolbar.new.export.tooltip', 'Export as JSON')}
    buttonTestId={newExportButtonSelector.container}
    onButtonClick={() => {
      locationService.partial({ shareView: shareDashboardType.export });

      DashboardInteractions.sharingCategoryClicked({
        item: shareDashboardType.export,
        shareResource: getTrackingSource(),
      });
    }}
    arrowLabel={t('dashboard.toolbar.new.export.arrow', 'Export')}
    arrowTestId={newExportButtonSelector.arrowMenu}
    dashboard={dashboard}
  />
);
