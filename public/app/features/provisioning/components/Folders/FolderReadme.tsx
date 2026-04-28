import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, EmptyState, LinkButton, Spinner, Stack } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';

import { RenderedReadme } from './RenderedReadme';

function buildReadmeTemplate(folderTitle: string): string {
  const heading = folderTitle?.trim() || 'Folder README';
  return [
    `# ${heading}`,
    '',
    "## What's in this folder",
    'Describe how the dashboards here are organized — sub-folders, naming conventions, ownership.',
    '',
    '## Finding the right dashboard',
    '- **Dashboard name** — what it answers / when to use it',
    '- **Dashboard name** — what it answers / when to use it',
    '',
  ].join('\n');
}

interface FolderReadmeContentProps {
  folderUID: string;
}

/**
 * Fetches and renders a README.md file from a Git Sync provisioned folder.
 * Shown in the README tab when the `provisioningReadmes` feature is enabled.
 */
export function FolderReadmeContent({ folderUID }: FolderReadmeContentProps) {
  const { repository, folder, readmePath, isRepoLoading, isFileLoading, isError, fileData } =
    useFolderReadme(folderUID);

  if (isRepoLoading || isFileLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" paddingY={4}>
        <Spinner size="lg" />
      </Box>
    );
  }

  if (!repository) {
    return (
      <EmptyState
        variant="not-found"
        message={t('browse-dashboards.readme.not-provisioned', 'This folder is not managed by a Git repository.')}
      />
    );
  }

  const editUrl = getRepoEditFileUrl({
    repoType: repository.type,
    url: repository.url,
    branch: repository.branch,
    filePath: readmePath,
    // readmePath is relative to the repository's configured root, so we prefix
    // with repository.path to point at the actual file inside the host repo.
    pathPrefix: repository.path,
  });

  if (isError || !fileData) {
    const folderTitle = folder?.spec?.title ?? '';
    const newFileUrl = getRepoNewFileUrl({
      repoType: repository.type,
      url: repository.url,
      branch: repository.branch,
      filePath: readmePath,
      pathPrefix: repository.path,
      template: buildReadmeTemplate(folderTitle),
    });

    return (
      <EmptyState
        variant="call-to-action"
        message={t('browse-dashboards.readme.not-found', 'No README.md file found in this folder.')}
        button={
          newFileUrl ? (
            <LinkButton
              href={newFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              icon="plus"
              size="lg"
              onClick={() => {
                reportInteraction('grafana_provisioning_readme_create_clicked', {
                  repositoryType: repository.type,
                });
              }}
            >
              {getCreateButtonLabel(repository.type)}
            </LinkButton>
          ) : undefined
        }
      >
        <Trans i18nKey="browse-dashboards.readme.add-hint">
          Add a README.md file to your repository to display documentation here.
        </Trans>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      {editUrl && (
        <Stack direction="row" justifyContent="flex-end">
          <LinkButton
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon="pen"
            variant="secondary"
            size="sm"
            onClick={() => {
              reportInteraction('grafana_provisioning_readme_edit_clicked', {
                repositoryType: repository.type,
              });
            }}
          >
            {getEditButtonLabel(repository.type)}
          </LinkButton>
        </Stack>
      )}
      <RenderedReadme file={fileData.resource?.file} />
    </Stack>
  );
}

function getEditButtonLabel(repoType?: string) {
  switch (repoType) {
    case 'github':
      return t('browse-dashboards.readme.edit-on-github', 'Edit on GitHub');
    case 'gitlab':
      return t('browse-dashboards.readme.edit-on-gitlab', 'Edit on GitLab');
    case 'bitbucket':
      return t('browse-dashboards.readme.edit-on-bitbucket', 'Edit on Bitbucket');
    default:
      return t('browse-dashboards.readme.edit', 'Edit');
  }
}

function getCreateButtonLabel(repoType?: string) {
  switch (repoType) {
    case 'github':
      return t('browse-dashboards.readme.create-on-github', 'Create README on GitHub');
    case 'gitlab':
      return t('browse-dashboards.readme.create-on-gitlab', 'Create README on GitLab');
    case 'bitbucket':
      return t('browse-dashboards.readme.create-on-bitbucket', 'Create README on Bitbucket');
    default:
      return t('browse-dashboards.readme.create', 'Create README');
  }
}

export { FolderReadmeContent as FolderReadme };
