import { t } from '@grafana/i18n';
import { Badge, LoadingBar, Stack } from '@grafana/ui';

interface Props {
  /** Direct children left to delete, if known (folders only -- dashboards have no cascadeDelete status). */
  remaining?: number;
}

/**
 * Shared visual for a folder or dashboard row undergoing an async, finalizer-driven cascade
 * delete (PoC for kubernetesFolderCascadeDeleteAsync): `metadata.deletionTimestamp` is set but the
 * item hasn't actually been removed yet. Mirrors provisioning's StatusBadge "Deleting" state
 * (public/app/features/provisioning/Shared/StatusBadge.tsx) rather than inventing a new visual
 * language, plus an indeterminate LoadingBar -- @grafana/ui has no determinate progress bar
 * component, so the decreasing remaining-child count (when known) is surfaced directly in the
 * badge text instead of a filled bar.
 */
export function CascadeDeleteIndicator({ remaining }: Props) {
  const text =
    remaining !== undefined
      ? t('browse-dashboards.cascade-delete-indicator.text-with-remaining', '', {
          count: remaining,
          defaultValue_one: 'Deleting ({{count}} left)',
          defaultValue_other: 'Deleting ({{count}} left)',
        })
      : t('browse-dashboards.cascade-delete-indicator.text', 'Deleting');

  return (
    <Stack direction="column" gap={0.25}>
      <Badge color="red" icon="spinner" text={text} />
      <LoadingBar width={80} ariaLabel={t('browse-dashboards.cascade-delete-indicator.loading-bar', 'Deleting')} />
    </Stack>
  );
}
