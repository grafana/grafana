import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import ExportMenu from '../../../sharing/ExportButton/ExportMenu';
import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

import { ShareExportDashboardButton } from './ShareExportDashboardButton';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton;

export const ExportDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const buttonTooltip = config.featureToggles.kubernetesDashboards
    ? t('dashboard.toolbar.new.export.tooltip.as-code', 'Export as code')
    : t('dashboard.toolbar.new.export.tooltip.json', 'Export as JSON');

  return (
    <ShareExportDashboardButton
      menu={() => <ExportMenu dashboard={dashboard} />}
      groupTestId={newExportButtonSelector.container}
      buttonLabel={t('dashboard.toolbar.new.export.title', 'Export')}
      buttonTooltip={buttonTooltip}
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
};
