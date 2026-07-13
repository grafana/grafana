import { useCallback, useMemo, useRef, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Drawer, Field, Select, Stack, Text } from '@grafana/ui';
import { type Repository, type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { GitSyncLimitationsAlert } from '../Shared/GitSyncLimitationsAlert';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { useSyncJob } from '../Wizard/hooks/useSyncJob';
import { type StepStatusInfo } from '../Wizard/types';

interface MigrateDrawerProps {
  repos: Repository[];
  onDismiss: () => void;
  /** Called once the migration job finishes successfully, so callers can refresh derived state. */
  onMigrated?: () => void;
  /**
   * Whether to scope the migration to `resources` (selective) or migrate every
   * unmanaged resource ("migrate everything"). Tracked explicitly rather than
   * inferred from `resources.length`, so a selection that happens to resolve to
   * no dashboard refs is never silently treated as a migrate-everything.
   */
  selective: boolean;
  /** Resource refs to migrate in selective mode. The folders that contain them come along. */
  resources?: ResourceRef[];
  /** Counts behind `resources`, used for the selective-mode summary copy. */
  selection?: { folders: number; resources: number };
}

/**
 * Drawer for running a migration, mirroring how other provisioning jobs run in
 * a drawer. The user selects the target repository here, confirms, and then the
 * migration job's progress and result are shown in the same drawer via the
 * shared JobStatus view.
 *
 * Two modes: "migrate everything" (no `resources`) exports every unmanaged
 * dashboard and folder; selective (with `resources`) exports only the picked
 * dashboards.
 */
export function MigrateDrawer({ repos, onDismiss, onMigrated, selective, resources, selection }: MigrateDrawerProps) {
  const isSelective = selective;
  // In selective mode there must be at least one dashboard ref to send.
  // Otherwise `startJob(true, { resources: [] })` collapses to migrate-everything
  // server-side, which would contradict the user's selection — so guard against
  // it here in the drawer too, not just in the caller.
  const hasResourcesToMigrate = !isSelective || (resources?.length ?? 0) > 0;

  // Migration writes directly to the repository's configured branch (the
  // `write` workflow). A repository that only opens pull requests (`branch`
  // workflow) or is read-only can't run a migration, so it stays in the list
  // but is disabled — the note below explains how to enable it.
  const repoOptions = useMemo<Array<SelectableValue<string>>>(
    () =>
      repos
        .filter((repo) => Boolean(repo.metadata?.name))
        .map((repo) => ({
          label: repo.spec?.title || repo.metadata?.name || '',
          value: repo.metadata?.name ?? '',
          description: repo.spec?.type,
          isDisabled: !repo.spec?.workflows.includes('write'),
        })),
    [repos]
  );

  const hasBlockedRepos = repoOptions.some((option) => option.isDisabled);

  // Only pre-select a repository when exactly one is usable. With several
  // options available we leave the choice to the user rather than guessing, and
  // we never pre-select a disabled (un-pushable) repository.
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>(() => {
    const selectable = repoOptions.filter((option) => !option.isDisabled);
    return selectable.length === 1 ? selectable[0].value : undefined;
  });

  const { job, startJob, isLoading } = useSyncJob({ repoName: selectedRepo ?? '' });
  const migratedRef = useRef(false);
  // Track the job's reported status so the drawer can surface errors/warnings.
  // Unlike the wizard, the drawer has no step-status chrome to render them, so
  // it renders the alert itself from the latest status reported by JobStatus.
  const [stepStatusInfo, setStepStatusInfo] = useState<StepStatusInfo>({ status: 'idle' });

  const selectedRepoObj = repos.find((repo) => repo.metadata?.name === selectedRepo);
  const syncTarget = selectedRepoObj?.spec?.sync?.target;

  const startMigration = useCallback(async () => {
    if (!selectedRepo || !hasResourcesToMigrate) {
      return;
    }
    await startJob(true, {
      syncTarget,
      ...(isSelective ? { resources } : {}),
    });
  }, [selectedRepo, hasResourcesToMigrate, startJob, isSelective, resources, syncTarget]);

  // Start a fresh job and let it replace the current one once created. We avoid
  // clearing `job` first so the drawer doesn't flash back to the setup form.
  const retryMigration = useCallback(() => {
    migratedRef.current = false;
    setStepStatusInfo({ status: 'idle' });
    void startMigration();
  }, [startMigration]);

  // JobStatus reports status changes as it polls. Keep the latest status so the
  // drawer can render error/warning alerts, and notify the caller once the
  // migration succeeds so it can refresh resource stats (the job invalidates
  // them server-side, but we trigger an explicit refetch to be safe).
  // Memoized so its identity is stable — JobContent re-runs its status effect
  // whenever this callback changes, so an unstable one would loop.
  const handleStatusChange = useCallback(
    (info: StepStatusInfo) => {
      setStepStatusInfo(info);
      if (info.status === 'success' && !migratedRef.current) {
        migratedRef.current = true;
        onMigrated?.();
      }
    },
    [onMigrated]
  );

  const title = t('provisioning.migrate.drawer-title', 'Migrate to GitOps');

  // Once the job is submitted, show only the job status view.
  if (job) {
    return (
      <Drawer title={title} onClose={onDismiss}>
        <Stack direction="column" gap={2}>
          {stepStatusInfo.status === 'error' && (
            <ProvisioningAlert error={stepStatusInfo.error} action={stepStatusInfo.action} />
          )}
          {'warning' in stepStatusInfo && stepStatusInfo.warning && (
            <ProvisioningAlert
              warning={stepStatusInfo.warning}
              action={stepStatusInfo.status === 'warning' ? stepStatusInfo.action : undefined}
            />
          )}
          <JobStatus watch={job} jobType="sync" onStatusChange={handleStatusChange} onRetry={retryMigration} />
        </Stack>
      </Drawer>
    );
  }

  return (
    <Drawer title={title} onClose={onDismiss}>
      <Stack direction="column" gap={2}>
        {isSelective ? (
          <Text color="secondary">
            {t('provisioning.migrate.drawer-description-selective', '', {
              count: selection?.resources ?? resources?.length ?? 0,
              defaultValue_one:
                '{{count}} selected resource (and the folder that contains it) will be migrated into the selected repository. This is a one-time operation.',
              defaultValue_other:
                '{{count}} selected resources (and the folders that contain them) will be migrated into the selected repository. This is a one-time operation.',
            })}
          </Text>
        ) : (
          <Text color="secondary">
            <Trans i18nKey="provisioning.migrate.drawer-description">
              All resources not yet managed by Git will be migrated into the selected repository. This is a one-time
              operation.
            </Trans>
          </Text>
        )}

        <Field
          noMargin
          label={t('provisioning.migrate.repo-label', 'Target repository')}
          description={t(
            'provisioning.migrate.repo-description',
            'The repository your resources will be migrated into.'
          )}
        >
          <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
            {repoOptions.length > 0 && (
              <Select
                inputId="migrate-target-repository"
                width={40}
                options={repoOptions}
                value={selectedRepo ?? null}
                placeholder={t('provisioning.migrate.repo-placeholder', 'Select a repository')}
                onChange={(option) => setSelectedRepo(option.value)}
              />
            )}
          </Stack>
        </Field>

        {hasBlockedRepos && (
          <Alert
            severity="info"
            title={t('provisioning.migrate.repo-no-push-title', 'Some repositories can’t be used for migration')}
          >
            <Trans i18nKey="provisioning.migrate.repo-no-push-body">
              Migration pushes directly to the repository’s configured branch. Repositories that aren’t set up to allow
              that are disabled above. To migrate into one, enable pushing to the configured branch in the repository’s
              settings — you may also need to temporarily allow pushes to that branch in your Git provider.
            </Trans>
          </Alert>
        )}

        <GitSyncLimitationsAlert syncTarget={syncTarget} />

        <Stack direction="row" gap={2}>
          <Button variant="secondary" fill="outline" onClick={onDismiss}>
            <Trans i18nKey="provisioning.migrate.drawer-cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!selectedRepo || isLoading || !hasResourcesToMigrate}
            onClick={startMigration}
            tooltip={
              !selectedRepo
                ? t('provisioning.migrate.migrate-button-disabled-tooltip', 'Select a target repository first')
                : !hasResourcesToMigrate
                  ? t('provisioning.migrate.migrate-button-empty-tooltip', 'Select at least one resource to migrate')
                  : undefined
            }
          >
            {isSelective ? (
              <Trans i18nKey="provisioning.migrate.migrate-button-selected">Migrate selected</Trans>
            ) : (
              <Trans i18nKey="provisioning.migrate.migrate-button">Migrate everything</Trans>
            )}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
