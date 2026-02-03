import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

/**
 * Actions menu for transformations.
 * Currently simplified - only supports delete action.
 *
 * @remarks
 * TODO: Implement full transformation actions when needed:
 * - Duplicate transformation
 * - Move up/down
 * - Transformation-specific settings
 */
export function TransformationActionsMenu() {
  const { deleteQuery } = useActionsContext();
  const { selectedTransformation } = useQueryEditorUIContext();

  if (!selectedTransformation) {
    return null;
  }

  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item label={t('query-editor.action.coming-soon', 'Transformation actions coming soon')} disabled />
          <Menu.Divider />
          <Menu.Item
            label={t('query-editor.action.remove-transformation', 'Remove transformation')}
            icon="trash-alt"
            onClick={() => deleteQuery(selectedTransformation.transformId)}
            destructive
          />
        </Menu>
      }
      placement="bottom-end"
    >
      <Button
        size="sm"
        fill="text"
        icon="ellipsis-v"
        variant="secondary"
        aria-label={t('query-editor.action.more-actions', 'More actions')}
        tooltip={t('query-editor.action.more-actions', 'More actions')}
      />
    </Dropdown>
  );
}
