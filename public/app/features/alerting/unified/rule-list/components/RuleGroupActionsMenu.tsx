import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export function RuleGroupActionsMenu() {
  return (
    <>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item label={t('alerting.group-actions.edit', 'Edit')} icon="pen" data-testid="edit-group-action" />
            <Menu.Item label={t('alerting.group-actions.reorder', 'Re-order rules')} icon="flip" />
            <Menu.Divider />
            <Menu.Item label={t('alerting.group-actions.export', 'Export')} icon="download-alt" />
            <Menu.Item label={t('alerting.group-actions.delete', 'Delete')} icon="trash-alt" destructive />
          </Menu>
        }
      >
        <IconButton name="ellipsis-h" aria-label={t('alerting.group-actions.actions-trigger', 'Rule group actions')} />
      </Dropdown>
    </>
  );
}
