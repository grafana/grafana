import { useCallback, useMemo, useRef, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Card, Checkbox, ConfirmModal, Drawer, Field, Input, Select, Stack, Text } from '@grafana/ui';
import { type Repository, type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { BranchValidationError } from '../Shared/BranchValidationError';
import { GitSyncLimitationsAlert } from '../Shared/GitSyncLimitationsAlert';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { useSyncJob } from '../Wizard/hooks/useSyncJob';
import { type StepStatusInfo } from '../Wizard/types';
import { generateNewBranchName } from '../components/utils/newBranchName';
import { validateBranchName } from '../utils/git';

// The write workflow the migration uses: commit directly to the configured
// branch, or open a pull request against a new branch.
type MigrateWorkflow = 'write' | 'branch';

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

  // A migration needs somewhere to land. The `write` workflow lets it commit
  // directly to the configured branch; the `branch` workflow lets it open a
  // pull request against another branch. A repository with neither (read-only)
  // can't run a migration, so it stays in the list but is disabled — the note
  // below explains how to enable it.
  const repoOptions = useMemo<Array<SelectableValue<string>>>(
    () =>
      repos
        .filter((repo) => Boolean(repo.metadata?.name))
        .map((repo) => {
          const workflows = repo.spec?.workflows ?? [];
          return {
            label: repo.spec?.title || repo.metadata?.name || '',
            value: repo.metadata?.name ?? '',
            description: repo.spec?.type,
            isDisabled: !workflows.includes('write') && !workflows.includes('branch'),
          };
        }),
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

  const workflows = selectedRepoObj?.spec?.workflows ?? [];
  const supportsWrite = workflows.includes('write');
  const supportsBranch = workflows.includes('branch');
  // A branch-only repo can't commit to its configured branch, so opening a pull
  // request is the only option; a write-capable repo defaults to committing to
  // the configured branch.
  const branchRequired = supportsBranch && !supportsWrite;

  // The write workflow the user picked: commit directly to the configured branch
  // or open a pull request. These are mutually exclusive, and the target branch
  // is only relevant (and editable) for the pull-request workflow.
  const [workflow, setWorkflow] = useState<MigrateWorkflow>(branchRequired ? 'branch' : 'write');
  // Keep the migrated resources on the instance instead of deleting them.
  const [skipResourceDeletion, setSkipResourceDeletion] = useState(false);
  // Generate fresh folder UIDs on export. Defaults per target (instance sync
  // preserves UIDs and takes folders over; every other target regenerates); the
  // user can override, with a confirmation when turning it off.
  const [generateNewFolderIDs, setGenerateNewFolderIDs] = useState(syncTarget !== 'instance');
  const [confirmDisableFolderIDs, setConfirmDisableFolderIDs] = useState(false);

  // Reset per-repo choices when the selected repository changes, so a choice made
  // for one repo doesn't carry into another.
  const [prevSelectedRepo, setPrevSelectedRepo] = useState(selectedRepo);
  if (selectedRepo !== prevSelectedRepo) {
    setPrevSelectedRepo(selectedRepo);
    setWorkflow(branchRequired ? 'branch' : 'write');
    setSkipResourceDeletion(false);
    setGenerateNewFolderIDs(syncTarget !== 'instance');
  }

  const isBranchWorkflow = supportsBranch && workflow === 'branch';

  // Auto-populate the target branch when opening a pull request. Keyed on the
  // repo and the workflow so the timestamped name is stable across renders and
  // matches what we display and submit.
  const generatedBranch = useMemo(
    () => (selectedRepo && isBranchWorkflow ? generateNewBranchName(`migrate-${selectedRepo}`) : ''),
    [selectedRepo, isBranchWorkflow]
  );

  // The generated name is only a default; the user can edit it. Re-seed the
  // editable value whenever the generated default changes.
  const [branchRef, setBranchRef] = useState(generatedBranch);
  const [prevGeneratedBranch, setPrevGeneratedBranch] = useState(generatedBranch);
  if (generatedBranch !== prevGeneratedBranch) {
    setPrevGeneratedBranch(generatedBranch);
    setBranchRef(generatedBranch);
  }

  // In the pull-request workflow the branch name must be a valid git ref.
  const branchNameValid = !isBranchWorkflow || Boolean(validateBranchName(branchRef));

  const canMigrate = Boolean(selectedRepo) && hasResourcesToMigrate && branchNameValid;

  const startMigration = useCallback(async () => {
    if (!canMigrate) {
      return;
    }
    await startJob(true, {
      syncTarget,
      generateNewFolderIDs,
      ...(isBranchWorkflow && branchRef ? { branch: branchRef } : {}),
      ...(isSelective ? { resources } : {}),
      ...(skipResourceDeletion ? { skipResourceDeletion: true } : {}),
    });
  }, [
    canMigrate,
    startJob,
    syncTarget,
    generateNewFolderIDs,
    isBranchWorkflow,
    branchRef,
    isSelective,
    resources,
    skipResourceDeletion,
  ]);

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
                onChange={(option) => {
                  setSelectedRepo(option.value);
                }}
              />
            )}
          </Stack>
        </Field>

        {selectedRepo && (supportsWrite || supportsBranch) && (
          <Field noMargin label={t('provisioning.migrate.workflow-label', 'How should changes be applied?')}>
            <Stack direction="column" gap={1}>
              {supportsWrite && (
                <Card noMargin isSelected={workflow === 'write'} onClick={() => setWorkflow('write')}>
                  <Card.Heading>
                    <Trans i18nKey="provisioning.migrate.workflow-write-title">Commit to the configured branch</Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Trans i18nKey="provisioning.migrate.workflow-write-description">
                      Write the migrated resources directly to the repository’s configured branch.
                    </Trans>
                  </Card.Description>
                </Card>
              )}
              {supportsBranch && (
                <Card noMargin isSelected={workflow === 'branch'} onClick={() => setWorkflow('branch')}>
                  <Card.Heading>
                    <Trans i18nKey="provisioning.migrate.workflow-branch-title">Open a pull request</Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Trans i18nKey="provisioning.migrate.workflow-branch-description">
                      Write the migrated resources to a new branch and open a pull request for review.
                    </Trans>
                  </Card.Description>
                </Card>
              )}
            </Stack>
          </Field>
        )}

        {isBranchWorkflow && (
          <Field
            noMargin
            label={t('provisioning.migrate.branch-label', 'Target branch')}
            description={t(
              'provisioning.migrate.branch-description-generated',
              'Grafana creates this branch and opens the pull request for you. Edit the name to use a different branch.'
            )}
            invalid={!branchNameValid}
            error={!branchNameValid ? <BranchValidationError /> : undefined}
          >
            <Input
              id="migrate-target-branch"
              width={40}
              value={branchRef}
              onChange={(e) => setBranchRef(e.currentTarget.value)}
            />
          </Field>
        )}

        {selectedRepo && (
          <>
            <Field noMargin>
              <Checkbox
                label={t('provisioning.migrate.retain-resources-label', 'Keep existing resources')}
                description={t(
                  'provisioning.migrate.retain-resources-description',
                  'Keep the migrated resources on this instance instead of deleting them after migration.'
                )}
                value={skipResourceDeletion}
                onChange={(e) => setSkipResourceDeletion(e.currentTarget.checked)}
              />
            </Field>

            <Field noMargin>
              <Checkbox
                label={t('provisioning.migrate.generate-folder-ids-label', 'Generate new folder IDs')}
                description={t(
                  'provisioning.migrate.generate-folder-ids-description',
                  'Create the migrated folders anew instead of taking over the existing folders.'
                )}
                value={generateNewFolderIDs}
                onChange={(e) => {
                  if (e.currentTarget.checked) {
                    setGenerateNewFolderIDs(true);
                  } else {
                    // Turning this off takes over existing folders — confirm first.
                    setConfirmDisableFolderIDs(true);
                  }
                }}
              />
            </Field>

            {!generateNewFolderIDs && (
              <Alert
                severity="warning"
                title={t(
                  'provisioning.migrate.generate-folder-ids-warning-title',
                  'Existing folders will be taken over'
                )}
              >
                <Trans i18nKey="provisioning.migrate.generate-folder-ids-warning-body">
                  Keeping the existing folder IDs takes over the current folders instead of creating new ones, which may
                  leave their alerts and library panels orphaned. Only disable this if you understand the impact.
                </Trans>
              </Alert>
            )}
          </>
        )}

        {hasBlockedRepos && (
          <Alert
            severity="info"
            title={t('provisioning.migrate.repo-no-push-title', 'Some repositories can’t be used for migration')}
          >
            <Trans i18nKey="provisioning.migrate.repo-no-push-body">
              Migration needs to write to the repository, either directly to its configured branch or through a pull
              request. Read-only repositories are disabled above. To migrate into one, enable the write or branch
              workflow in the repository’s settings — you may also need to allow pushes in your Git provider.
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
            disabled={isLoading || !canMigrate}
            onClick={startMigration}
            tooltip={
              !selectedRepo
                ? t('provisioning.migrate.migrate-button-disabled-tooltip', 'Select a target repository first')
                : !hasResourcesToMigrate
                  ? t('provisioning.migrate.migrate-button-empty-tooltip', 'Select at least one resource to migrate')
                  : !branchNameValid
                    ? t(
                        'provisioning.migrate.migrate-button-invalid-branch-tooltip',
                        'Enter a valid target branch name'
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

        <ConfirmModal
          isOpen={confirmDisableFolderIDs}
          title={t('provisioning.migrate.generate-folder-ids-confirm-title', 'Keep existing folder IDs?')}
          body={t(
            'provisioning.migrate.generate-folder-ids-confirm-body',
            'The existing folders will be taken over instead of created anew, which can leave their alerts and library panels orphaned. Are you sure?'
          )}
          confirmText={t('provisioning.migrate.generate-folder-ids-confirm-button', 'Keep existing IDs')}
          onConfirm={() => {
            setGenerateNewFolderIDs(false);
            setConfirmDisableFolderIDs(false);
          }}
          onDismiss={() => setConfirmDisableFolderIDs(false)}
        />
      </Stack>
    </Drawer>
  );
}
