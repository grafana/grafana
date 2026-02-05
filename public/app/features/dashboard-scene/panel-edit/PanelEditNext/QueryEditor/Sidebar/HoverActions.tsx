import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Button, Stack } from '@grafana/ui';

import { useActionsContext } from '../QueryEditorContext';

interface HoverActionsProps {
  query: DataQuery;
}

export function HoverActions({ query }: HoverActionsProps) {
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();

  return (
    <Stack direction="row" gap={0}>
      <Button
        size="sm"
        fill="text"
        icon="copy"
        variant="secondary"
        aria-label={t('query-editor.action.duplicate', 'Duplicate query')}
        onClick={() => duplicateQuery(query.refId)}
      />
      <Button
        size="sm"
        fill="text"
        icon="trash-alt"
        variant="secondary"
        aria-label={t('query-editor.action.delete', 'Delete query')}
        onClick={() => deleteQuery(query.refId)}
      />
      <Button
        size="sm"
        fill="text"
        icon={query.hide ? 'eye-slash' : 'eye'}
        variant="secondary"
        aria-label={
          query.hide
            ? t('query-editor.action.show', 'Show card {{id}}', { id: query.refId })
            : t('query-editor.action.hide', 'Hide card {{id}}', { id: query.refId })
        }
        onClick={() => toggleQueryHide(query.refId)}
      />
    </Stack>
  );
}
