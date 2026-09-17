import { t } from '@grafana/i18n';
import { Badge, Stack, Tooltip } from '@grafana/ui';

import { useCascadeDeleteProgress } from '../utils/useCascadeDeleteProgress';

import { CascadeDeleteProgressBar } from './CascadeDeleteProgressBar';

interface Props {
  /** Direct children left to delete, if known (folders only -- dashboards have no cascadeDelete status). */
  remaining?: number;
  /**
   * Non-fatal errors from the last reconcile pass (folders only), e.g. a legacy subfolder that
   * can't be removed because it predates the cascade-delete finalizer. The controller keeps
   * retrying on its own rate-limited schedule -- this isn't necessarily permanent -- but the user
   * who triggered the delete (or anyone else who looks at this folder later) should be able to see
   * why it's stuck instead of watching a spinner indefinitely.
   */
  errors?: string[];
}

/**
 * Shared visual for a folder or dashboard row undergoing an async, finalizer-driven cascade
 * delete (PoC for kubernetesFolderCascadeDeleteAsync): `metadata.deletionTimestamp` is set but the
 * item hasn't actually been removed yet. Mirrors provisioning's StatusBadge "Deleting" state
 * (public/app/features/provisioning/Shared/StatusBadge.tsx) rather than inventing a new visual
 * language, plus a progress bar that actually fills up as remaining drops (see
 * useCascadeDeleteProgress and CascadeDeleteProgressBar) so this reads as an operation that's
 * moving, not one that might be stuck.
 */
export function CascadeDeleteIndicator({ remaining, errors }: Props) {
  const percent = useCascadeDeleteProgress(remaining);

  if (errors && errors.length > 0) {
    return (
      <Tooltip content={errors.join('\n')} interactive>
        <span>
          <Badge
            color="orange"
            icon="exclamation-triangle"
            text={t('browse-dashboards.cascade-delete-indicator.error-text', 'Deletion stuck — hover for details')}
          />
        </span>
      </Tooltip>
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
      <Badge color="red" icon="spinner" text={text} />
      <CascadeDeleteProgressBar percent={percent} />
    </Stack>
  );
}
