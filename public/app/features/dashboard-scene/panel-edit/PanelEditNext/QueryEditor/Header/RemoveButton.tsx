import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

/**
 * Button to remove the currently selected query.
 * Reads the selected query from context and determines its own visibility.
 */
export function RemoveButton() {
  const { deleteQuery } = useActionsContext();
  const { cardType } = useQueryEditorUIContext();
  const { selectedQuery } = useQueryEditorUIContext();

  const typeLabel = QUERY_EDITOR_TYPE_CONFIG[cardType].getLabel();

  if (!selectedQuery) {
    return null;
  }

  return (
    <Button
      size="sm"
      fill="text"
      icon="trash-alt"
      variant="secondary"
      onClick={() => deleteQuery(selectedQuery.refId)}
      tooltip={t('query-editor-next.action.remove', 'Remove {{type}}', { type: typeLabel })}
    />
  );
}
