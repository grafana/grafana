import { useMemo, useRef, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Combobox, type ComboboxOption, Drawer, Field, Stack, Text } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';
import { GitSyncLimitationsAlert } from '../Shared/GitSyncLimitationsAlert';
import { useSyncJob } from '../Wizard/hooks/useSyncJob';
import { type StepStatusInfo } from '../Wizard/types';

interface MigrateDrawerProps {
  repos: Repository[];
  onDismiss: () => void;
  /** Called once the migration job finishes successfully, so callers can refresh derived state. */
  onMigrated?: () => void;
}

/**
 * Drawer for the "migrate everything" flow, mirroring how other provisioning
 * jobs run in a drawer. The user selects the target repository here, confirms,
 * and then the migration job's progress and result are shown in the same
 * drawer via the shared JobStatus view.
 */
export function MigrateDrawer({ repos, onDismiss, onMigrated }: MigrateDrawerProps) {
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

  const startMigration = async () => {
    if (!selectedRepo) {
      return;
    }
    await startJob(true);
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
        <Text color="secondary">
          <Trans i18nKey="provisioning.migrate.drawer-description">
            All dashboards and folders will be migrated into the selected repository. This is a one-time operation.
          </Trans>
        </Text>

        <Field
          noMargin
          label={t('provisioning.migrate.repo-label', 'Target repository')}
          description={t(
            'provisioning.migrate.repo-description',
            'The repository your dashboards and folders will be migrated into.'
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
            <ConnectRepositoryButton items={repos} />
          </Stack>
        </Field>

        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.migrate.selective-coming-soon">
            Migrating only selected dashboards and folders is coming soon.
          </Trans>
        </Text>

        <GitSyncLimitationsAlert syncTarget="instance" />

        <Stack direction="row" gap={2}>
          <Button variant="secondary" fill="outline" onClick={onDismiss}>
            <Trans i18nKey="provisioning.migrate.drawer-cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!selectedRepo || isLoading}
            onClick={startMigration}
            tooltip={
              !selectedRepo
                ? t('provisioning.migrate.migrate-button-disabled-tooltip', 'Select a target repository first')
                : undefined
            }
          >
            <Trans i18nKey="provisioning.migrate.migrate-button">Migrate everything</Trans>
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
