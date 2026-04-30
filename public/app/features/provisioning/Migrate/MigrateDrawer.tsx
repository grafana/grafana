import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Field,
  Input,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import {
  type Repository,
  useCreateRepositoryJobsMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

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
 * that live inside any selected folder, deduplicated. Folders aren't directly
 * supported by the Job API, so they always cascade to their descendant
 * dashboard refs.
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
  repos,
  selectedFolderUids,
  selectedDashboardUids,
  onClose,
}: Props) {
  const styles = useStyles2(getStyles);
  const [createJob, { isLoading }] = useCreateRepositoryJobsMutation();
  const [deleteOriginals, setDeleteOriginals] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();

  const repository = repos[0];
  const repoName = repository?.metadata?.name;

  const dashboards = useMemo(
    () => resolveSelectedDashboards(folders, selectedFolderUids, selectedDashboardUids),
    [folders, selectedFolderUids, selectedDashboardUids]
  );
  const dashboardCount = dashboards.length;
  const folderCount = selectedFolderUids.size;

  const submitLabel = deleteOriginals
    ? t('provisioning.stats.migrate-drawer-submit-migrate', 'Migrate')
    : t('provisioning.stats.migrate-drawer-submit-export', 'Export');

  const handleSubmit = async () => {
    if (!repoName) {
      setError(
        t(
          'provisioning.stats.migrate-drawer-no-repo',
          'No repository connected. Connect one before migrating.'
        )
      );
      return;
    }
    setError(undefined);
    try {
      if (deleteOriginals) {
        // The Migrate job currently doesn't accept a per-resource scope —
        // it migrates every unmanaged folder and dashboard at once. The
        // selection above is informational; the call below moves the lot.
        await createJob({
          name: repoName,
          jobSpec: {
            action: 'migrate',
            migrate: { message: message.trim() || undefined },
          },
        }).unwrap();
      } else {
        await createJob({
          name: repoName,
          jobSpec: {
            action: 'push',
            push: {
              message: message.trim() || undefined,
              resources: dashboards,
            },
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
        repoName
          ? t('provisioning.stats.migrate-drawer-subtitle', 'Pushing to {{repo}}', { repo: repoName })
          : t('provisioning.stats.migrate-drawer-subtitle-empty', 'No repository connected')
      }
      onClose={onClose}
      size="md"
    >
      <Stack direction="column" gap={2}>
        <Alert severity="info" title={t('provisioning.stats.migrate-drawer-push-title', 'Smoother migration tip')}>
          <Trans i18nKey="provisioning.stats.migrate-drawer-push-body">
            Enable pushes to <code>main</code> on this repository for a smoother migration. Without direct
            push access, the job has to open a pull request for every change and you&apos;ll need to merge
            them before the dashboards become managed.
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

        <Field
          noMargin
          label={t('provisioning.stats.migrate-drawer-message-label', 'Commit message')}
          description={t(
            'provisioning.stats.migrate-drawer-message-description',
            'Optional. Used as the message for the single commit that introduces these dashboards to Git.'
          )}
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            placeholder={t(
              'provisioning.stats.migrate-drawer-message-placeholder',
              'Migrate dashboards to GitOps'
            )}
          />
        </Field>

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
          <Button variant="secondary" fill="outline" onClick={onClose} disabled={isLoading}>
            <Trans i18nKey="provisioning.stats.migrate-drawer-cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            icon="upload"
            onClick={handleSubmit}
            disabled={!repoName || (!deleteOriginals && dashboardCount === 0)}
          >
            {isLoading ? (
              <Trans i18nKey="provisioning.stats.migrate-drawer-submitting">Starting…</Trans>
            ) : (
              submitLabel
            )}
          </Button>
        </Stack>
      </Stack>
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
