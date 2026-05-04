import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Checkbox, Combobox, Drawer, Field, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { type BulkActionFormData } from '../components/BulkActions/utils';
import { ResourceEditFormSharedFields } from '../components/Shared/ResourceEditFormSharedFields';
import { getCanPushToConfiguredBranch, getDefaultWorkflow } from '../components/defaults';
import { generateTimestamp } from '../components/utils/timestamp';
import { useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';

import { type FolderRow } from './hooks/useFolderLeaderboard';

interface ResourceRef {
  name: string;
  group: 'dashboard.grafana.app';
  kind: 'Dashboard';
}

interface Props {
  folders: FolderRow[];
  repos: Repository[];
  selectedFolderUids: Set<string>;
  selectedDashboardUids: Set<string>;
  onClose: () => void;
}

/**
 * Resolves the union of explicitly-selected dashboard UIDs and the dashboards
 * that live inside any selected folder. Folders aren't directly supported by
 * the Job API, so they always cascade to their descendant dashboard refs.
 */
function resolveSelectedDashboards(
  folders: FolderRow[],
  selectedFolderUids: Set<string>,
  selectedDashboardUids: Set<string>
): ResourceRef[] {
  const seen = new Set<string>();
  const refs: ResourceRef[] = [];
  const push = (uid: string) => {
    if (seen.has(uid)) {
      return;
    }
    seen.add(uid);
    refs.push({ name: uid, group: 'dashboard.grafana.app', kind: 'Dashboard' });
  };
  selectedDashboardUids.forEach(push);
  for (const folder of folders) {
    if (selectedFolderUids.has(folder.uid)) {
      folder.allDashboards.forEach((d) => push(d.uid));
    }
  }
  return refs;
}

export function MigrateDrawer({ folders, repos, selectedFolderUids, selectedDashboardUids, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const repoOptions = useMemo(
    () =>
      repos
        .filter((r) => Boolean(r.metadata?.name))
        .map((r) => ({
          label: r.metadata?.name ?? '',
          value: r.metadata?.name ?? '',
          description: r.spec?.title || r.spec?.type,
        })),
    [repos]
  );
  const [selectedRepoName, setSelectedRepoName] = useState<string | undefined>(repoOptions[0]?.value);
  const {
    repository,
    isReadOnlyRepo,
    isLoading: isLoadingRepo,
  } = useGetResourceRepositoryView({
    name: selectedRepoName,
  });
  const [createJob, { isLoading: isSubmitting }] = useCreateRepositoryJobsMutation();
  const [deleteOriginals, setDeleteOriginals] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const dashboards = useMemo(
    () => resolveSelectedDashboards(folders, selectedFolderUids, selectedDashboardUids),
    [folders, selectedFolderUids, selectedDashboardUids]
  );
  const dashboardCount = dashboards.length;
  const folderCount = selectedFolderUids.size;

  const initialValues: BulkActionFormData = useMemo(
    () => ({
      comment: '',
      ref: `migrate-to-gitops/${generateTimestamp()}`,
      workflow: getDefaultWorkflow(repository),
    }),
    [repository]
  );

  const methods = useForm<BulkActionFormData>({ defaultValues: initialValues });
  const { handleSubmit, reset } = methods;

  // The default workflow depends on what the resolved repository allows. When
  // the user switches repos the form needs a new default — but we can't call
  // reset() during render. Reset only when the workflow that the form was
  // initialised with no longer matches what the new repo permits.
  useEffect(() => {
    reset(initialValues);
  }, [reset, initialValues]);

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const submit = async (data: BulkActionFormData) => {
    if (!repository?.name) {
      setError(
        t('provisioning.stats.migrate-drawer-no-repo', 'No repository connected. Connect one before migrating.')
      );
      return;
    }
    setError(undefined);
    const ref = data.workflow === 'write' ? undefined : data.ref;
    const message = data.comment?.trim() || undefined;
    try {
      if (deleteOriginals) {
        // The Migrate job currently doesn't accept a per-resource scope —
        // it migrates every unmanaged folder and dashboard at once.
        await createJob({
          name: repository.name,
          jobSpec: { action: 'migrate', migrate: { message } },
        }).unwrap();
      } else {
        await createJob({
          name: repository.name,
          jobSpec: {
            action: 'push',
            push: { message, branch: ref, resources: dashboards },
          },
        }).unwrap();
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('provisioning.stats.migrate-drawer-error', 'Failed to start migration job')));
    }
  };

  return (
    <Drawer
      title={
        <Text variant="h3" element="h2">
          <Trans i18nKey="provisioning.stats.migrate-drawer-title">Migrate to GitOps</Trans>
        </Text>
      }
      subtitle={
        repository?.name
          ? t('provisioning.stats.migrate-drawer-subtitle', 'Pushing to {{repo}}', { repo: repository.name })
          : t('provisioning.stats.migrate-drawer-subtitle-empty', 'No repository connected')
      }
      onClose={onClose}
      size="md"
    >
      {isLoadingRepo ? null : !repository ? (
        <Alert
          severity="warning"
          title={t('provisioning.stats.migrate-drawer-no-repo-title', 'No repository connected')}
        >
          <Trans i18nKey="provisioning.stats.migrate-drawer-no-repo-body">
            Connect a writable repository before migrating.
          </Trans>
        </Alert>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(submit)}>
            <Stack direction="column" gap={2}>
              <Alert
                severity="warning"
                title={t(
                  'provisioning.stats.migrate-drawer-explainer-title',
                  'Review how migration works before continuing'
                )}
              >
                <Stack direction="column" gap={2}>
                  <Text>
                    <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-intro">
                      Migration runs as a one-time job. It exports the selected dashboards (and the folders that contain
                      them) to the connected repository so Git becomes the source of truth. Once a dashboard is managed,
                      every subsequent change in Grafana is also pushed to the repository, and pulls from the repository
                      sync back into Grafana. See the{' '}
                      <TextLink
                        external
                        href="https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/intro-git-sync/"
                      >
                        Git Sync documentation
                      </TextLink>{' '}
                      for the full picture.
                    </Trans>
                  </Text>
                  <ul className={styles.explainerList}>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-edits">
                        Dashboards can still be edited in Grafana while the job runs, but those changes may not make it
                        into the export.
                      </Trans>
                    </li>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-unsupported">
                        Alerts and library panels are not supported in provisioned folders. Anything inside a migrated
                        folder that isn&apos;t a dashboard stays behind in Grafana.
                      </Trans>
                    </li>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-folders">
                        The folder structure is replicated in the repository. The original folders are kept in Grafana —
                        empty after migration if every dashboard inside them moved.
                      </Trans>
                    </li>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-duration">
                        How long it takes depends on how many dashboards and folders are involved.
                      </Trans>
                    </li>
                  </ul>
                  <Text weight="medium">
                    <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-workflow-title">
                      How the workflow you pick below changes things:
                    </Trans>
                  </Text>
                  <ul className={styles.explainerList}>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-workflow-write">
                        <strong>
                          Push directly to <code>main</code>
                        </strong>
                        : the job writes a single commit to the default branch. Dashboards become managed as soon as the
                        commit lands — smoothest experience, but it does mean the change skips review.
                      </Trans>
                    </li>
                    <li>
                      <Trans i18nKey="provisioning.stats.migrate-drawer-explainer-workflow-branch">
                        <strong>Push to a branch and open a pull request</strong>: the job pushes to the branch you pick
                        and opens a PR. Dashboards stay unmanaged until the PR is merged into <code>main</code>. Pick
                        this when you need review, but expect to manage the PR before migration completes.
                      </Trans>
                    </li>
                  </ul>
                </Stack>
              </Alert>

              <div className={styles.summary}>
                <Text variant="bodySmall" color="secondary">
                  {deleteOriginals ? (
                    <Trans
                      i18nKey="provisioning.stats.migrate-drawer-summary-migrate"
                      values={{ folders: folderCount, dashboards: dashboardCount }}
                      defaults="With “Delete original dashboards” enabled, the job migrates every unmanaged folder and dashboard on this instance — your {{folders}} folder / {{dashboards}} dashboard selection isn't used to scope it. Disable the option below to push only what you picked."
                    />
                  ) : (
                    <Trans
                      i18nKey="provisioning.stats.migrate-drawer-summary-push"
                      values={{ folders: folderCount, dashboards: dashboardCount }}
                      defaults="You picked {{folders}} folders and {{dashboards}} dashboards. Folder selections include every dashboard inside them."
                    />
                  )}
                </Text>
              </div>

              {repoOptions.length > 1 && (
                <Field
                  noMargin
                  label={t('provisioning.stats.migrate-drawer-repo-label', 'Target repository')}
                  description={t(
                    'provisioning.stats.migrate-drawer-repo-description',
                    'Pick the repository to push the migrated dashboards to.'
                  )}
                >
                  <Combobox
                    options={repoOptions}
                    value={selectedRepoName ?? null}
                    onChange={(opt) => setSelectedRepoName(opt?.value)}
                  />
                </Field>
              )}
              {isReadOnlyRepo && (
                <Alert
                  severity="warning"
                  title={t(
                    'provisioning.stats.migrate-drawer-readonly-title',
                    'This repository cannot accept changes from Grafana'
                  )}
                >
                  {repoOptions.length > 1 ? (
                    <Trans i18nKey="provisioning.stats.migrate-drawer-readonly-body-multi">
                      Pick a writable repository above, or update this one&apos;s permissions and try again.
                    </Trans>
                  ) : (
                    <Trans i18nKey="provisioning.stats.migrate-drawer-readonly-body-single">
                      Connect a writable repository or update this one&apos;s permissions and try again.
                    </Trans>
                  )}
                </Alert>
              )}
              {!isReadOnlyRepo && (
                <ResourceEditFormSharedFields
                  resourceType="dashboard"
                  isNew={false}
                  canPushToConfiguredBranch={canPushToConfiguredBranch}
                  repository={repository}
                  hiddenFields={['path']}
                />
              )}

              <Field
                noMargin
                description={t(
                  'provisioning.stats.migrate-drawer-delete-description',
                  'When enabled, the originals are removed from Grafana and the repository takes over them. Disable it to copy them into Git while keeping the originals untouched.'
                )}
              >
                <Checkbox
                  value={deleteOriginals}
                  onChange={(e) => setDeleteOriginals(e.currentTarget.checked)}
                  label={t(
                    'provisioning.stats.migrate-drawer-delete-label',
                    'Delete original dashboards after pushing them to Git'
                  )}
                />
              </Field>

              {error && <Alert severity="error" title={error} />}

              <Stack direction="row" gap={1} justifyContent="flex-end">
                <Button variant="secondary" fill="outline" onClick={onClose} disabled={isSubmitting}>
                  <Trans i18nKey="provisioning.stats.migrate-drawer-cancel">Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon="upload"
                  disabled={isSubmitting || isReadOnlyRepo || (!deleteOriginals && dashboardCount === 0)}
                >
                  {isSubmitting ? (
                    <Trans i18nKey="provisioning.stats.migrate-drawer-submitting">Starting…</Trans>
                  ) : deleteOriginals ? (
                    <Trans i18nKey="provisioning.stats.migrate-drawer-submit-migrate">Migrate</Trans>
                  ) : (
                    <Trans i18nKey="provisioning.stats.migrate-drawer-submit-export">Export</Trans>
                  )}
                </Button>
              </Stack>
            </Stack>
          </form>
        </FormProvider>
      )}
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css({
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  explainerList: css({
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    '& code': {
      fontFamily: theme.typography.fontFamilyMonospace,
      background: theme.colors.background.canvas,
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
    },
  }),
});
