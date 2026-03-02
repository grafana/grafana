import { useCallback, useContext, useMemo } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { IconName, Menu, ModalsContext } from '@grafana/ui';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { SaveBeforeShareModal } from '../SaveBeforeShareModal';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

export interface ExportDrawerMenuItem {
  shareId: string;
  testId?: string;
  label: string;
  description?: string;
  icon: IconName;
  renderCondition: boolean;
  onClick: (d: DashboardScene) => void;
}

const customShareDrawerItem: ExportDrawerMenuItem[] = [];

export function addDashboardExportDrawerItem(item: ExportDrawerMenuItem) {
  customShareDrawerItem.push(item);
}

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const { showModal, hideModal } = useContext(ModalsContext);

  const onMenuItemClick = (shareView: string) => {
    locationService.partial({ shareView });
  };

  const buildMenuItems = useCallback(() => {
    const menuItems: ExportDrawerMenuItem[] = [];

    customShareDrawerItem.forEach((d) => menuItems.push(d));

    const label = config.featureToggles.kubernetesDashboards
      ? t('dashboard.toolbar.new.export.tooltip.as-code', 'Export as code')
      : t('share-dashboard.menu.export-json-title', 'Export as JSON');

    menuItems.push({
      shareId: shareDashboardType.export,
      testId: newExportButtonSelector.exportAsJson,
      icon: 'arrow',
      label,
      renderCondition: true,
      onClick: () => onMenuItemClick(shareDashboardType.export),
    });

    menuItems.push({
      shareId: shareDashboardType.image,
      testId: newExportButtonSelector.exportAsImage,
      icon: 'camera',
      label: t('share-dashboard.menu.export-image-title', 'Export as image'),
      renderCondition: Boolean(config.featureToggles.sharingDashboardImage),
      onClick: () => onMenuItemClick(shareDashboardType.image),
    });

    return menuItems.filter((item) => item.renderCondition);
  }, []);

  const onClick = useCallback(
    (item: ExportDrawerMenuItem) => {
      const continueAction = () => {
        DashboardInteractions.sharingCategoryClicked({
          item: item.shareId,
          shareResource: getTrackingSource(),
        });

        item.onClick(dashboard);
      };

      if (dashboard.state.isEditing && dashboard.state.isDirty) {
        showModal(SaveBeforeShareModal, { dashboard, onContinue: continueAction, onDismiss: hideModal });
        return;
      }

      continueAction();
    },
    [dashboard, hideModal, showModal]
  );

  const menuItems = useMemo(() => buildMenuItems(), [buildMenuItems]);

  const menuItemsWithHandlers = useMemo(() => {
    return menuItems.map((item) => ({
      ...item,
      onSelect: () => onClick(item),
    }));
  }, [menuItems, onClick]);

  return (
    <Menu
      ariaLabel={t('dashboard.export.menu.label', 'Export dashboard menu')}
      data-testid={newExportButtonSelector.container}
    >
      {menuItemsWithHandlers.map((item) => (
        <Menu.Item
          key={item.label}
          label={item.label}
          icon={item.icon}
          description={item.description}
          onClick={item.onSelect}
          testId={item.testId}
        />
      ))}
    </Menu>
  );
}
