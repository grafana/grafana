import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

interface HoverActionsProps {
  onDuplicate?: () => void;
  onDelete: () => void;
  onToggleHide: () => void;
  isHidden: boolean;
}

export function HoverActions({ onDuplicate, onDelete, onToggleHide, isHidden }: HoverActionsProps) {
  const { cardType } = useQueryEditorUIContext();
  const typeLabel = QUERY_EDITOR_TYPE_CONFIG[cardType].getLabel();

  return (
    <Stack direction="row" gap={0}>
      {onDuplicate && (
        <Button
          size="sm"
          fill="text"
          icon="copy"
          variant="secondary"
          aria-label={t('query-editor.action.duplicate', 'Duplicate {{type}}', { type: typeLabel })}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        />
      )}
      <Button
        size="sm"
        fill="text"
        icon="trash-alt"
        variant="secondary"
        aria-label={t('query-editor.action.remove', 'Remove {{type}}', { type: typeLabel })}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      />
      <Button
        size="sm"
        fill="text"
        icon={isHidden ? 'eye-slash' : 'eye'}
        variant="secondary"
        aria-label={
          isHidden
            ? t('query-editor.action.show', 'Show {{type}}', { type: typeLabel })
            : t('query-editor.action.hide', 'Hide {{type}}', { type: typeLabel })
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide();
        }}
      />
    </Stack>
  );
}
