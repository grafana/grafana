import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Dropdown, Sidebar } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DashboardScene } from '../scene/DashboardScene';
import ExportMenu from '../sharing/ExportButton/ExportMenu';
import { DashboardInteractions } from '../utils/interactions';

interface Props {
  dashboard: DashboardScene;
}

const newExportButtonSelector = selectors.pages.Dashboard.DashNav.NewExportButton;

export function ShareExportDashboardButton({ dashboard }: Props) {
  return (
    <Dropdown overlay={<ExportMenu dashboard={dashboard} />} placement="left-end">
      <Sidebar.Button
        icon="download-alt"
        data-testid={newExportButtonSelector.Menu.container}
        title={t('dashboard.sidebar.export.title', 'Export')}
        onPointerDown={(evt) => {
          if (dashboard.state.isEditing && dashboard.state.isDirty) {
            evt.preventDefault();
            evt.stopPropagation();

            appEvents.publish(
              new ShowConfirmModalEvent({
                title: t('dashboard.sidebar.export.unsaved-modal.title', 'Save changes to dashboard?'),
                text: t(
                  'dashboard.sidebar.export.unsaved-modal.text',
                  'You have unsaved changes to this dashboard. You need to save them before you can share it.'
                ),
                icon: 'exclamation-triangle',
                noText: t('common.discard', 'Discard'),
                yesText: t('common.save', 'Save'),
                yesButtonVariant: 'primary',
                onConfirm: () => dashboard.openSaveDrawer({}),
              })
            );
          } else {
            locationService.partial({ shareView: shareDashboardType.export });

            DashboardInteractions.sharingCategoryClicked({
              item: shareDashboardType.export,
              shareResource: getTrackingSource(),
            });
          }
        }}
      />
    </Dropdown>
  );
}
