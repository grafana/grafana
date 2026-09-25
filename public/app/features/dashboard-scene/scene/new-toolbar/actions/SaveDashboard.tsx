import { useState, type ReactElement, type ReactNode } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { useFlagGrafanaCustomDashboardTemplates, useFlagGrafanaDashboardPreviewMode } from '@grafana/runtime/internal';
import { Button, ButtonGroup, ConfirmModal, Dropdown, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { canManageDashboardTemplates } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/templatePermissions';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { getSaveAsTemplateForm } from 'app/features/dashboard-scene/saving/enterprise-components/SaveAsTemplateFormExtension';

import { getDashboardSaveActions } from '../../../saving/dashboardSaveActions';
import { dashboardModesEnabled, getDashboardMode } from '../../dashboardModes';
import { type ToolbarActionProps } from '../types';

export const SaveDashboard = ({ dashboard }: ToolbarActionProps) => {
  const { meta, uid, editview, isEditing } = dashboard.state;
  const isDirty = dashboard.state.isDirty;
  const hasPendingCodeChanges = dashboard.hasPendingCodeChanges();
  const isCodeMode = dashboardModesEnabled() && getDashboardMode(dashboard.state) === 'code';
  const hasUnappliedCode = isCodeMode && hasPendingCodeChanges;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isDashboardTemplatesFlagEnabled = useFlagGrafanaCustomDashboardTemplates();
  const isPreviewModeEnabled = useFlagGrafanaDashboardPreviewMode();
  const showChanges = isPreviewModeEnabled && isEditing;

  const { save, saveAsCopy: onSaveAsCopy, isNew } = getDashboardSaveActions(dashboard, isDashboardTemplatesFlagEnabled);
  if (isCodeMode) {
    return null;
  }
  const isManaged = dashboard.isManaged();
  const saveDisabled = isCodeMode && (hasPendingCodeChanges || (!isDirty && !isNew));
  const saveTooltip = hasUnappliedCode
    ? t('dashboard.modes.apply-before-save', 'Apply code changes before saving')
    : t('dashboard.toolbar.new.save-dashboard.tooltip', 'Save changes');
  // In dashboard settings we still use the nav toolbar for a short while
  const buttonSize = Boolean(editview) ? 'sm' : 'md';

  const renderSaveButton = (button: ReactElement, saveOptions?: ReactNode) => {
    if (!saveOptions && !showChanges) {
      return button;
    }

    return (
      <>
        <ConfirmModal
          isOpen={confirmDiscard}
          title={t('dashboard.modes.discard-title', 'Discard dashboard changes?')}
          body={t(
            'dashboard.modes.discard-body',
            'This restores the last saved dashboard and discards pending code edits.'
          )}
          confirmText={t('dashboard.modes.discard', 'Discard changes')}
          onConfirm={() => {
            dashboard.discardChangesAndKeepEditing();
            setConfirmDiscard(false);
          }}
          onDismiss={() => setConfirmDiscard(false)}
        />
        <ButtonGroup>
          {button}
          <Dropdown
            overlay={
              <Menu>
                {saveOptions}
                {showChanges && saveOptions && <Menu.Divider />}
                {showChanges && (
                  <Menu.Item
                    label={t('dashboard.preview.view-changes', 'View changes')}
                    icon="code-branch"
                    disabled={hasUnappliedCode}
                    onClick={() => dashboard.openChanges()}
                  />
                )}
                {dashboardModesEnabled() && (isDirty || hasPendingCodeChanges) && (
                  <Menu.Item
                    label={t('dashboard.modes.discard', 'Discard changes')}
                    icon="trash-alt"
                    onClick={() => setConfirmDiscard(true)}
                  />
                )}
              </Menu>
            }
          >
            <Button
              aria-label={t('dashboard.toolbar.new.more-save-options', 'More save options')}
              icon="angle-down"
              variant={!hasUnappliedCode && (isDirty || isNew) ? 'primary' : 'secondary'}
              size={buttonSize}
              data-testid={selectors.components.NavToolbar.editDashboard.moreSaveOptionsButton}
            />
          </Dropdown>
        </ButtonGroup>
      </>
    );
  };

  // Template edit flow
  if (isDashboardTemplatesFlagEnabled && meta.isDashboardTemplate) {
    if (!meta.canSave) {
      return null;
    }
    return renderSaveButton(
      <Button
        onClick={save}
        tooltip={
          hasUnappliedCode ? saveTooltip : t('dashboard.toolbar.new.save-template.tooltip', 'Save template changes')
        }
        disabled={saveDisabled}
        size={buttonSize}
        variant={isDirty && !hasUnappliedCode ? 'primary' : 'secondary'}
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-template.label">Save</Trans>
      </Button>
    );
  }

  // if we only can save
  if (isNew) {
    return renderSaveButton(
      <Button
        onClick={save}
        tooltip={saveTooltip}
        disabled={saveDisabled}
        size={buttonSize}
        variant={hasUnappliedCode ? 'secondary' : 'primary'}
        data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-dashboard.label">Save</Trans>
      </Button>
    );
  }

  // If we only can save as copy
  if (contextSrv.hasEditPermissionInFolders && !meta.canSave && !meta.canMakeEditable && !isManaged) {
    return renderSaveButton(
      <Button
        onClick={onSaveAsCopy}
        tooltip={
          hasUnappliedCode ? saveTooltip : t('dashboard.toolbar.new.save-dashboard-copy.tooltip', 'Save as copy')
        }
        disabled={hasUnappliedCode}
        size={buttonSize}
        variant={isDirty && !hasUnappliedCode ? 'primary' : 'secondary'}
      >
        <Trans i18nKey="dashboard.toolbar.new.save-dashboard-copy.label">Save as copy</Trans>
      </Button>
    );
  }

  return renderSaveButton(
    <Button
      onClick={save}
      tooltip={saveTooltip}
      disabled={saveDisabled}
      size={buttonSize}
      data-testid={selectors.components.NavToolbar.editDashboard.saveButton}
      variant={isDirty && !hasUnappliedCode ? 'primary' : 'secondary'}
      data-testactive={(isDirty && !hasUnappliedCode) || undefined} // used in e2e tests to verify if dsahboard has unsaved changes
    >
      <Trans i18nKey="dashboard.toolbar.new.save-dashboard.label">Save</Trans>
    </Button>,
    <>
      <Menu.Item
        label={t('dashboard.toolbar.new.save-dashboard-short', 'Save')}
        icon="save"
        disabled={saveDisabled}
        onClick={save}
      />
      <Menu.Item
        label={t('dashboard.toolbar.new.save-dashboard-copy.label', 'Save as copy')}
        icon="copy"
        disabled={hasUnappliedCode}
        onClick={onSaveAsCopy}
        testId={selectors.components.NavToolbar.editDashboard.saveAsCopyButton}
      />
      {isDashboardTemplatesFlagEnabled &&
        canManageDashboardTemplates() &&
        meta.canSave &&
        getSaveAsTemplateForm() !== null && (
          <Menu.Item
            label={t('dashboard.toolbar.save-as-template.label', 'Save as template')}
            icon="grid"
            disabled={hasUnappliedCode}
            onClick={() => {
              CustomDashboardTemplateInteractions.saveAsOpened({
                dashboardUid: uid ?? '',
              });
              dashboard.openSaveDrawer({ saveAsDashboardTemplate: true });
            }}
          />
        )}
    </>
  );
};
