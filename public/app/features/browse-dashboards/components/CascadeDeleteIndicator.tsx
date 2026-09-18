import { t } from '@grafana/i18n';
import { Badge, Stack } from '@grafana/ui';

import { useCascadeDeleteProgress } from '../utils/useCascadeDeleteProgress';

import { CascadeDeleteProgressBar } from './CascadeDeleteProgressBar';

interface Props {
  /** Direct children left to delete, if known (folders only -- dashboards have no cascadeDelete status). */
  remaining?: number;
  /**
   * Non-fatal errors from the last reconcile pass (folders only), e.g. a legacy subfolder that
   * can't be removed because it predates the cascade-delete finalizer. The controller keeps
   * retrying on its own rate-limited schedule -- this isn't necessarily permanent. Not rendered
   * here (a hover tooltip doesn't scale to a growing error list) -- just used to switch to the
   * stuck-looking badge; see FolderCascadeStatusBanner for the actual error detail.
   */
  errors?: string[];
}

/**
 * Shared visual for a folder or dashboard row undergoing an async, finalizer-driven cascade
 * delete (PoC for kubernetesFolderCascadeDeleteAsync): `metadata.deletionTimestamp` is set but the
 * item hasn't actually been removed yet. Plus a progress bar that actually fills up as remaining
 * drops (see useCascadeDeleteProgress and CascadeDeleteProgressBar) so this reads as an operation
 * that's moving, not one that might be stuck. Only the errors branch below (an actually-stuck
 * cascade) uses an attention color.
 */
export function CascadeDeleteIndicator({ remaining, errors }: Props) {
  const percent = useCascadeDeleteProgress(remaining);

  if (errors && errors.length > 0) {
    return (
      <Badge
        color="orange"
        icon="exclamation-triangle"
        text={t('browse-dashboards.cascade-delete-indicator.error-text', 'Deletion stuck')}
      />
    );
  }

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
      <Badge color="blue" icon="spinner" text={text} />
      <CascadeDeleteProgressBar percent={percent} />
    </Stack>
  );
}
