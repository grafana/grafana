import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function HoverActions() {
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const { selectedQuery } = useQueryEditorUIContext();
  if (!selectedQuery) {
    return null;
  }
  return (
    <Stack direction="row" gap={0}>
      <Button
        size="sm"
        fill="text"
        icon="copy"
        variant="secondary"
        aria-label={t('query-editor.action.duplicate', 'Duplicate query')}
        onClick={() => duplicateQuery(selectedQuery.refId)}
      />
      <Button
        size="sm"
        fill="text"
        icon="trash-alt"
        variant="secondary"
        aria-label={t('query-editor.action.delete', 'Delete query')}
        onClick={() => deleteQuery(selectedQuery.refId)}
      />
      <Button
        size="sm"
        fill="text"
        icon={selectedQuery.hide ? 'eye-slash' : 'eye'}
        variant="secondary"
        aria-label={
          selectedQuery.hide
            ? t('query-editor.action.show', 'Show card {{id}}', { id: selectedQuery.refId })
            : t('query-editor.action.hide', 'Hide card {{id}}', { id: selectedQuery.refId })
        }
        onClick={() => toggleQueryHide(selectedQuery.refId)}
      />
    </Stack>
  );
}
