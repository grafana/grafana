import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu } from '@grafana/ui';
import { type RepoType } from 'app/features/provisioning/Wizard/types';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/tooltip';
import { getNewPhrase } from 'app/features/search/tempI18nPhrases';
import { type FolderDTO } from 'app/types/folders';

import { type CreateNewAction, NewFolderDrawer, useCreateNewActions } from './CreateNewMenu';

interface Props {
  parentFolder?: FolderDTO;
  canCreateFolder: boolean;
  canCreateDashboard: boolean;
  isReadOnlyRepo: boolean;
  repoType?: RepoType;
}

export default function CreateNewButton({
  parentFolder,
  canCreateDashboard,
  canCreateFolder,
  isReadOnlyRepo,
  repoType,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);
  const actions = useCreateNewActions({
    parentFolder,
    canCreateDashboard,
    canCreateFolder,
    onNewFolder: () => setShowNewFolderDrawer(true),
  });

  const handleVisibleChange = () => {
    if (!isOpen) {
      reportInteraction('grafana_create_new_button_menu_opened', {
        from: location.pathname,
      });
    }
    setIsOpen(!isOpen);
  };

  const dashboardActions = actions.filter((action) => action.group === 'dashboard');
  const folderActions = actions.filter((action) => action.group === 'folder');

  const newMenu = (
    <Menu>
      {dashboardActions.length > 0 && (
        <Menu.Group label={t('browse-dashboards.create-new.dashboard-group', 'Dashboard')}>
          {dashboardActions.map(renderMenuItem)}
        </Menu.Group>
      )}
      {folderActions.length > 0 && (
        <>
          {dashboardActions.length > 0 && <Menu.Divider />}
          {folderActions.map(renderMenuItem)}
        </>
      )}
    </Menu>
  );

  return (
    <>
      <Dropdown overlay={newMenu} placement="bottom-end" onVisibleChange={handleVisibleChange}>
        <Button
          disabled={isReadOnlyRepo}
          tooltip={isReadOnlyRepo ? getReadOnlyTooltipText({ isLocal: repoType === 'local' }) : undefined}
          variant="secondary"
          data-testid={selectors.components.CreateNewButton.newButton}
        >
          {getNewPhrase()}
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
      {showNewFolderDrawer && (
        <NewFolderDrawer parentFolder={parentFolder} onClose={() => setShowNewFolderDrawer(false)} />
      )}
    </>
  );
}

function renderMenuItem(action: CreateNewAction) {
  return (
    <Menu.Item
      key={action.id}
      label={action.label}
      icon={action.icon}
      iconColor={action.iconColor}
      url={action.url}
      onClick={action.onClick}
      testId={action.testId}
    />
  );
}
