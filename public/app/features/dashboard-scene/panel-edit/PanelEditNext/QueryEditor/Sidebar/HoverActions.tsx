import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

interface HoverActionsProps {
  onDuplicate?: () => void;
  onDelete: () => void;
  onToggleHide: () => void;
  isHidden: boolean;
}

export function HoverActions({ onDuplicate, onDelete, onToggleHide, isHidden }: HoverActionsProps) {
  // we know that the actions are for a query if we have onDuplicate
  const typeText = onDuplicate ? 'query' : 'transformation';

  return (
    <Stack direction="row" gap={0}>
      {onDuplicate && (
        <Button
          size="sm"
          fill="text"
          icon="copy"
          variant="secondary"
          aria-label={t('query-editor.action.duplicate', 'Duplicate query')}
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
        aria-label={t('query-editor.action.delete', 'Delete {{type}}', { type: typeText })}
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
            ? t('query-editor.action.show', 'Show {{type}}', { type: typeText })
            : t('query-editor.action.hide', 'Hide {{type}}', { type: typeText })
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide();
        }}
      />
    </Stack>
  );
}
