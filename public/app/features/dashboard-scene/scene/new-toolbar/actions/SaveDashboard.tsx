import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getSaveAsTemplateForm } from 'app/features/dashboard-scene/saving/enterprise-components/SaveAsTemplateFormExtension';

import { type ToolbarActionProps } from '../types';

export const SaveDashboard = ({ dashboard }: ToolbarActionProps) => {
  const { meta, isDirty, uid, editview, editPanel } = dashboard.state;

  const isNew = !Boolean(uid || dashboard.isManaged());
  const isManaged = dashboard.isManaged();
  // In dashboard settings we still use the nav toolbar for a short while
  const buttonSize = Boolean(editview) || editPanel ? 'sm' : 'md';

  // Org-template edit flow
  if (meta.isOrgTemplate) {
    if (!meta.canSave) {
      return null;
    }
    return (
      <Button
        onClick={() => dashboard.openSaveDrawer({ updateOrgTemplate: true })}
        tooltip={t('dashboard.toolbar.new.save-template.tooltip', 'Save template changes')}
        size={buttonSize}
        variant={isDirty ? 'primary' : 'secondary'}
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-template.label">Save</Trans>
      </Button>
    );
  }

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
        data-testactive={isDirty || undefined} // used in e2e tests to verify if dsahboard has unsaved changes
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
            {config.featureToggles.orgDashboardTemplates && getSaveAsTemplateForm() !== null && (
              <Menu.Item
                label={t('dashboard.toolbar.save-as-template.label', 'Save as template')}
                icon="grid"
                onClick={() => {
                  dashboard.openSaveDrawer({ saveAsOrgTemplate: true });
                }}
              />
            )}
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
