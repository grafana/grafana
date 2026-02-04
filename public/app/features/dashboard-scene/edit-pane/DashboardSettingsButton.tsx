import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Modal, ModalTabsHeader, TabContent } from '@grafana/ui';

import { GeneralSettingsEditView } from '../settings/GeneralSettingsEditView';

type DashboardSettingsButtonProps = {
  onClickGoToLegacySettingsPage: () => void;
};

/**
    1. ✅ Click on Settings opens the modal
    2. 💡 The modal has tabs these tabs:
    - 💡 General
    - Links
    - Versions
    - Permissions
    - JSON Model
    3. Open questions:
        - deeplinking support?
 
    ## Next session
 
    - Create new SettingsScene object:
      - instantiated in Dashboard Scene
      - contains all the tabs
      - Mounted when DashboardEditableElement renders the settings button
 */

export function DashboardSettingsButton({ onClickGoToLegacySettingsPage }: DashboardSettingsButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTabId, setActiveTabId] = useState('general');

  const generalSettings = useMemo(() => new GeneralSettingsEditView({ isModalSettings: true }), []);

  const tabs = [
    {
      value: 'general',
      label: t('dashboard-scene.dashboard-settings-button.tabs.label.general', 'General'),
    },
  ];
  const modalHeader = (
    <ModalTabsHeader
      title=""
      icon="cog"
      tabs={tabs}
      activeTab={activeTabId}
      onChangeTab={(t) => setActiveTabId(t.value)}
    />
  );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
        icon="sliders-v-alt"
        iconPlacement="right"
      >
        <Trans i18nKey="dashboard.actions.open-settings">Settings</Trans>
      </Button>
      <Modal
        title={modalHeader}
        isOpen={isModalOpen}
        ariaLabel={t('dashboard-scene.dashboard-settings-button.ariaLabel-settings', 'Settings')}
      >
        <TabContent>{activeTabId === 'general' && <generalSettings.Component model={generalSettings} />}</TabContent>
      </Modal>
    </>
  );
}
