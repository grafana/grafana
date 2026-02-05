import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

export function HoverActions() {
  return (
    <Stack direction="row" gap={0}>
      <Button
        size="sm"
        fill="text"
        icon="copy"
        variant="secondary"
        aria-label={t('query-editor.action.duplicate', 'Duplicate query')}
      />
      <Button
        size="sm"
        fill="text"
        icon="trash-alt"
        variant="secondary"
        aria-label={t('query-editor.action.delete', 'Delete query')}
      />
      {/* TODO: Add hide/show query button */}
      <Button
        size="sm"
        fill="text"
        icon="eye-slash"
        variant="secondary"
        aria-label={t('query-editor.action.hide', 'Hide query')}
      />
    </Stack>
  );
}
