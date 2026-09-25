import { t } from '@grafana/i18n';
import { useFlagGrafanaCustomDashboardTemplates } from '@grafana/runtime/internal';
import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';

import { getDashboardSaveActions } from '../saving/dashboardSaveActions';
import { type DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
  hasChanges: boolean;
  invalid: boolean;
  onApply: () => boolean;
}

export function DashboardCodeSaveButton({ dashboard, hasChanges, invalid, onApply }: Props) {
  const templatesEnabled = useFlagGrafanaCustomDashboardTemplates();
  const { save, saveAsCopy, isNew, isTemplate, copyOnly, canSave } = getDashboardSaveActions(
    dashboard,
    templatesEnabled
  );
  const variant = hasChanges || dashboard.state.isDirty || isNew ? 'primary' : 'secondary';
  const applyAndSave = (asCopy: boolean) => {
    if (invalid || !canSave || !onApply()) {
      return;
    }
    return asCopy ? saveAsCopy() : save();
  };

  return (
    <ButtonGroup>
      <Button size="md" variant={variant} disabled={invalid || !hasChanges} onClick={onApply}>
        {t('dashboard.modes.code.apply', 'Apply changes')}
      </Button>
      {canSave && (
        <Dropdown
          placement="bottom-end"
          overlay={
            <Menu>
              {!copyOnly && (
                <Menu.Item
                  label={t('dashboard.modes.code.apply-and-save', 'Apply changes and Save')}
                  icon="save"
                  disabled={invalid || (!hasChanges && !dashboard.state.isDirty && !isNew)}
                  onClick={() => applyAndSave(false)}
                />
              )}
              {!isNew && !isTemplate && (
                <Menu.Item
                  label={t('dashboard.toolbar.new.save-dashboard-copy.label', 'Save as copy')}
                  icon="copy"
                  disabled={invalid}
                  onClick={() => applyAndSave(true)}
                />
              )}
            </Menu>
          }
        >
          <Button
            size="md"
            variant={variant}
            icon="angle-down"
            aria-label={t('dashboard.modes.code.apply-options', 'More apply options')}
          />
        </Dropdown>
      )}
    </ButtonGroup>
  );
}
