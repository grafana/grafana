import { useMemo, useRef, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Combobox, type ComboboxOption, Drawer, Field, Stack, Text } from '@grafana/ui';
import { type Repository, type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { GitSyncLimitationsAlert } from '../Shared/GitSyncLimitationsAlert';
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
  /** Dashboard refs to migrate in selective mode. The folders that contain them come along. */
  resources?: ResourceRef[];
  /** Counts behind `resources`, used for the selective-mode summary copy. */
  selection?: { folders: number; dashboards: number };
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

  const repoOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      repos
        .filter((repo) => Boolean(repo.metadata?.name))
        .map((repo) => ({
          label: repo.spec?.title || repo.metadata?.name || '',
          value: repo.metadata?.name ?? '',
          description: repo.spec?.type,
        })),
    [repos]
  );

  // Only pre-select a repository when exactly one is connected. With several
  // repositories available we leave the choice to the user rather than guessing.
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>(() =>
    repoOptions.length === 1 ? repoOptions[0].value : undefined
  );

  const { job, startJob, isLoading } = useSyncJob({ repoName: selectedRepo ?? '' });
  const migratedRef = useRef(false);

  // Migration writes directly to the repository's configured branch (the
  // `write` workflow). A repository that only opens pull requests (`branch`
  // workflow) can't run a migration, so block it and explain why.
  const selectedRepoObj = repos.find((repo) => repo.metadata?.name === selectedRepo);
  const canPushToConfiguredBranch = selectedRepoObj?.spec?.workflows?.includes('write') ?? false;
  const blockedByWorkflow = Boolean(selectedRepo) && !canPushToConfiguredBranch;

  const startMigration = async () => {
    if (!selectedRepo) {
      return;
    }
    await startJob(true, isSelective ? { resources } : undefined);
  };

  // Start a fresh job and let it replace the current one once created. We avoid
  // clearing `job` first so the drawer doesn't flash back to the setup form.
  const retryMigration = () => {
    migratedRef.current = false;
    void startMigration();
  };

  // JobStatus reports status changes as it polls; notify the caller once the
  // migration succeeds so it can refresh resource stats (the job invalidates
  // them server-side, but we trigger an explicit refetch to be safe).
  const handleStatusChange = (info: StepStatusInfo) => {
    if (info.status === 'success' && !migratedRef.current) {
      migratedRef.current = true;
      onMigrated?.();
    }
  };

  const title = t('provisioning.migrate.drawer-title', 'Migrate to GitOps');

  // Once the job is submitted, show only the job status view.
  if (job) {
    return (
      <Drawer title={title} onClose={onDismiss}>
        <JobStatus watch={job} jobType="sync" onStatusChange={handleStatusChange} onRetry={retryMigration} />
      </Drawer>
    );
  }

  return (
    <Drawer title={title} onClose={onDismiss}>
      <Stack direction="column" gap={2}>
        {isSelective ? (
          <Text color="secondary">
            {t('provisioning.migrate.drawer-description-selective', '', {
              count: selection?.dashboards ?? resources?.length ?? 0,
              defaultValue_one:
                '{{count}} selected resource (and the folder that contains it) will be migrated into the selected repository. This is a one-time operation.',
              defaultValue_other:
                '{{count}} selected resources (and the folders that contain them) will be migrated into the selected repository. This is a one-time operation.',
            })}
          </Text>
        ) : (
          <Text color="secondary">
            <Trans i18nKey="provisioning.migrate.drawer-description">
              All folders and resources will be migrated into the selected repository. This is a one-time operation.
            </Trans>
          </Text>
        )}

        <Field
          noMargin
          label={t('provisioning.migrate.repo-label', 'Target repository')}
          description={t(
            'provisioning.migrate.repo-description',
            'The repository your folders and resources will be migrated into.'
          )}
        >
          <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
            {repoOptions.length > 0 && (
              <Combobox
                id="migrate-target-repository"
                width={40}
                options={repoOptions}
                value={selectedRepo ?? null}
                placeholder={t('provisioning.migrate.repo-placeholder', 'Select a repository')}
                onChange={(option) => setSelectedRepo(option.value)}
              />
            )}
          </Stack>
        </Field>

        {blockedByWorkflow && (
          <Alert
            severity="error"
            title={t('provisioning.migrate.repo-no-push-title', 'This repository can’t be used for migration')}
          >
            <Trans i18nKey="provisioning.migrate.repo-no-push-body">
              Migration pushes directly to the repository’s configured branch, but this repository isn’t set up to allow
              that. Choose a repository that can push to its configured branch, or update this repository’s workflow.
            </Trans>
          </Alert>
        )}

        <GitSyncLimitationsAlert syncTarget="instance" />

        <Stack direction="row" gap={2}>
          <Button variant="secondary" fill="outline" onClick={onDismiss}>
            <Trans i18nKey="provisioning.migrate.drawer-cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!selectedRepo || isLoading || blockedByWorkflow}
            onClick={startMigration}
            tooltip={
              !selectedRepo
                ? t('provisioning.migrate.migrate-button-disabled-tooltip', 'Select a target repository first')
                : blockedByWorkflow
                  ? t(
                      'provisioning.migrate.migrate-button-blocked-tooltip',
                      'This repository can’t push to its configured branch'
                    )
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
