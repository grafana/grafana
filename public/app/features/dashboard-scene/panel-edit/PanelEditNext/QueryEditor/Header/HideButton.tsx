import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function HideButton() {
  const { toggleQueryHide } = useActionsContext();
  const { selectedQuery } = useQueryEditorUIContext();

  if (!selectedQuery) {
    return null;
  }

  const isHidden = Boolean(selectedQuery.hide);

  return (
    <Button
      size="sm"
      fill="text"
      icon={isHidden ? 'eye-slash' : 'eye'}
      variant="secondary"
      onClick={() => toggleQueryHide(selectedQuery.refId)}
      tooltip={
        isHidden ? t('query-editor.action.show', 'Show response') : t('query-editor.action.hide', 'Hide response')
      }
    />
  );
}
