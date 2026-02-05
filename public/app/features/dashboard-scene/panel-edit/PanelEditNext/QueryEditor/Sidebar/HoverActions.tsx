import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

export function HoverActions() {
  return (
    <Stack direction="row" gap={1}>
      <Button
        size="sm"
        fill="text"
        icon="ellipsis-v"
        variant="secondary"
        aria-label={t('query-editor.action.more-actions', 'More actions')}
      />
    </Stack>
  );
}
