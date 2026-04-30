import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Checkbox, Drawer, Field, Stack, Text, useStyles2 } from '@grafana/ui';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
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
  repositoryName?: string;
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

export function MigrateDrawer({
  folders,
  repositoryName,
  selectedFolderUids,
  selectedDashboardUids,
  onClose,
}: Props) {
  const styles = useStyles2(getStyles);
  const { repository, isReadOnlyRepo, isLoading: isLoadingRepo } = useGetResourceRepositoryView({
    name: repositoryName,
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

  if (initialValues.workflow !== methods.getValues('workflow')) {
    reset(initialValues);
  }

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const submit = async (data: BulkActionFormData) => {
    if (!repository?.name) {
      setError(
        t(
          'provisioning.stats.migrate-drawer-no-repo',
          'No repository connected. Connect one before migrating.'
        )
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
      setError(
        extractErrorMessage(
          err,
          t('provisioning.stats.migrate-drawer-error', 'Failed to start migration job')
        )
      );
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
      {isLoadingRepo ? null : !repository || isReadOnlyRepo ? (
        <Alert
          severity="warning"
          title={t(
            'provisioning.stats.migrate-drawer-readonly-title',
            'This repository cannot accept changes from Grafana'
          )}
        >
          <Trans i18nKey="provisioning.stats.migrate-drawer-readonly-body">
            Connect a writable repository or update this one&apos;s permissions and try again.
          </Trans>
        </Alert>
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(submit)}>
            <Stack direction="column" gap={2}>
              <Alert
                severity="info"
                title={t('provisioning.stats.migrate-drawer-push-title', 'Smoother migration tip')}
              >
                <Trans i18nKey="provisioning.stats.migrate-drawer-push-body">
                  Enable pushes to <code>main</code> on this repository for a smoother migration. Without
                  direct push access, the job opens a pull request for every change and you&apos;ll need to
                  merge them before the dashboards become managed.
                </Trans>
              </Alert>

              <div className={styles.summary}>
                <Text variant="bodySmall" color="secondary">
                  <Trans
                    i18nKey="provisioning.stats.migrate-drawer-summary"
                    values={{ folders: folderCount, dashboards: dashboardCount }}
                    defaults="You picked {{folders}} folders and {{dashboards}} dashboards. Folder selections include every dashboard inside them."
                  />
                </Text>
              </div>

              <ResourceEditFormSharedFields
                resourceType="dashboard"
                isNew={false}
                canPushToConfiguredBranch={canPushToConfiguredBranch}
                repository={repository}
                hiddenFields={['path']}
              />

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
                  disabled={isSubmitting || (!deleteOriginals && dashboardCount === 0)}
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
});
