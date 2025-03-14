import { selectors } from '@grafana/e2e-selectors';
import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

import { ToolbarActionProps } from '../types';

export const SaveDashboard = ({ dashboard }: ToolbarActionProps) => {
  const { meta, isDirty, uid } = dashboard.state;

  const isNew = !Boolean(uid || dashboard.isManaged());

  // if we  only can save
  if (isNew) {
    return (
      <Button
        onClick={() => dashboard.openSaveDrawer({})}
        tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
        size="sm"
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      >
        <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
      </Button>
    );
  }

  // If we only can save as copy
  if (contextSrv.hasEditPermissionInFolders && !meta.canSave && !meta.canMakeEditable && !dashboard.isManaged()) {
    return (
      <Button
        onClick={() => dashboard.openSaveDrawer({ saveAsCopy: true })}
        tooltip={t('dashboard.toolbar.save-dashboard-copy.tooltip', 'Save as copy')}
        size="sm"
        variant={isDirty ? 'primary' : 'secondary'}
      >
        <Trans i18nKey="dashboard.toolbar.save-dashboard-copy.label">Save as copy</Trans>
      </Button>
    );
  }

  return (
    <ButtonGroup>
      <Button
        onClick={() => dashboard.openSaveDrawer({})}
        tooltip={t('dashboard.toolbar.save-dashboard.tooltip', 'Save changes')}
        size="sm"
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
        variant={isDirty ? 'primary' : 'secondary'}
      >
        <Trans i18nKey="dashboard.toolbar.save-dashboard.label">Save dashboard</Trans>
      </Button>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t('dashboard.toolbar.save-dashboard-short', 'Save')}
              icon="save"
              onClick={() => dashboard.openSaveDrawer({})}
            />
            <Menu.Item
              label={t('dashboard.toolbar.save-dashboard-copy.label', 'Save as copy')}
              icon="copy"
              onClick={() => dashboard.openSaveDrawer({ saveAsCopy: true })}
            />
          </Menu>
        }
      >
        <Button
          aria-label={t('dashboard.toolbar.more-save-options', 'More save options')}
          icon="angle-down"
          variant={isDirty ? 'primary' : 'secondary'}
          size="sm"
        />
      </Dropdown>
    </ButtonGroup>
  );
};
