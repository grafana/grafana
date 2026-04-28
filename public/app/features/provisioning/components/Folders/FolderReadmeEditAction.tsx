import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';
import { getRepoEditFileUrl } from '../../utils/git';

interface Props {
  folderUID: string;
}

/**
 * Edit-on-host link rendered in the README tab's page action bar. Renders
 * nothing when no README exists or when the host has no edit URL pattern.
 */
export function FolderReadmeEditAction({ folderUID }: Props) {
  const { repository, readmePath, fileData } = useFolderReadme(folderUID);

  if (!repository || !fileData) {
    return null;
  }

  const editUrl = getRepoEditFileUrl({
    repoType: repository.type,
    url: repository.url,
    branch: repository.branch,
    filePath: readmePath,
    pathPrefix: repository.path,
  });

  if (!editUrl) {
    return null;
  }

  return (
    <LinkButton
      href={editUrl}
      target="_blank"
      rel="noopener noreferrer"
      icon="external-link-alt"
      variant="secondary"
      onClick={() => {
        reportInteraction('grafana_provisioning_readme_edit_clicked', {
          repositoryType: repository.type,
        });
      }}
    >
      <Trans i18nKey="browse-dashboards.readme.edit-readme">Edit README</Trans>
    </LinkButton>
  );
}
