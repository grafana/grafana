import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

interface HoverActionsProps {
  onDuplicate?: () => void;
  onDelete: () => void;
  onToggleHide: () => void;
  isHidden: boolean;
}

export function HoverActions({ onDuplicate, onDelete, onToggleHide, isHidden }: HoverActionsProps) {
  return (
    <Stack direction="row" gap={0}>
      {onDuplicate && (
        <Button
          size="sm"
          fill="text"
          icon="copy"
          variant="secondary"
          aria-label={t('query-editor.action.duplicate', 'Duplicate query')}
          onClick={onDuplicate}
        />
      )}
      <Button
        size="sm"
        fill="text"
        icon="trash-alt"
        variant="secondary"
        aria-label={t('query-editor.action.delete', 'Delete query')}
        onClick={onDelete}
      />
      <Button
        size="sm"
        fill="text"
        icon={isHidden ? 'eye-slash' : 'eye'}
        variant="secondary"
        aria-label={isHidden ? t('query-editor.action.show', 'Show card') : t('query-editor.action.hide', 'Hide card')}
        onClick={onToggleHide}
      />
    </Stack>
  );
}
