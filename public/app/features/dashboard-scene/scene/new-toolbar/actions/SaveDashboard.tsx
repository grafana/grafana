import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { ToolbarActionProps } from '../types';

export const SaveDashboard = ({ dashboard }: ToolbarActionProps) => {
  const { meta, isDirty, uid, editview, editPanel } = dashboard.state;

  const isNew = !Boolean(uid || dashboard.isManaged());
  const isManaged = dashboard.isManaged();
  // In dashboard settings we still use the nav toolbar for a short while
  const buttonSize = Boolean(editview) || editPanel ? 'sm' : 'md';

  // if we only can save
  if (isNew) {
    return (
      <Button
        onClick={() => dashboard.openSaveDrawer({})}
        tooltip={t('dashboard.toolbar.new.save-dashboard.tooltip', 'Save changes')}
        size={buttonSize}
        variant="primary"
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-dashboard.label">Save</Trans>
      </Button>
    );
  }

  // If we only can save as copy
  if (contextSrv.hasEditPermissionInFolders && !meta.canSave && !meta.canMakeEditable && !isManaged) {
    return (
      <Button
        onClick={() => dashboard.openSaveDrawer({ saveAsCopy: true })}
        tooltip={t('dashboard.toolbar.new.save-dashboard-copy.tooltip', 'Save as copy')}
        size={buttonSize}
        variant={isDirty ? 'primary' : 'secondary'}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-dashboard-copy.label">Save as copy</Trans>
      </Button>
    );
  }

  return (
    <ButtonGroup>
      <Button
        onClick={() => dashboard.openSaveDrawer({})}
        tooltip={t('dashboard.toolbar.new.save-dashboard.tooltip', 'Save changes')}
        size={buttonSize}
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
        variant={isDirty ? 'primary' : 'secondary'}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-dashboard.label">Save</Trans>
      </Button>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t('dashboard.toolbar.new.save-dashboard-short', 'Save')}
              icon="save"
              onClick={() => dashboard.openSaveDrawer({})}
            />
            <Menu.Item
              label={t('dashboard.toolbar.new.save-dashboard-copy.label', 'Save as copy')}
              icon="copy"
              onClick={() => dashboard.openSaveDrawer({ saveAsCopy: true })}
            />
          </Menu>
        }
      >
        <Button
          aria-label={t('dashboard.toolbar.new.more-save-options', 'More save options')}
          icon="angle-down"
          variant={isDirty ? 'primary' : 'secondary'}
          size={buttonSize}
        />
      </Dropdown>
    </ButtonGroup>
  );
};
