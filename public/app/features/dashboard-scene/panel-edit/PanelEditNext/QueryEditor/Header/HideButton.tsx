import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function HideButton() {
  const { toggleQueryHide } = useActionsContext();
  const { cardType } = useQueryEditorUIContext();
  const { selectedQuery } = useQueryEditorUIContext();

  if (!selectedQuery) {
    return null;
  }

  const typeLabel = QUERY_EDITOR_TYPE_CONFIG[cardType].getLabel();
  const isHidden = Boolean(selectedQuery.hide);

  return (
    <Button
      size="sm"
      fill="text"
      icon={isHidden ? 'eye-slash' : 'eye'}
      variant="secondary"
      onClick={() => toggleQueryHide(selectedQuery.refId)}
      tooltip={
        isHidden
          ? t('query-editor-next.action.show', 'Show {{type}}', { type: typeLabel })
          : t('query-editor-next.action.hide', 'Hide {{type}}', { type: typeLabel })
      }
    />
  );
}
