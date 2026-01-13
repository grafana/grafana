import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Card, Spinner, useStyles2 } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

interface FolderReadmeProps {
  folderUID: string | undefined;
}

/**
 * FolderReadme fetches and renders a README.md file from a Git Sync provisioned folder.
 * It only renders when:
 * - The provisioning feature is enabled
 * - The folder is managed by a repository
 * - The README.md file exists and can be fetched
 */
export function FolderReadme({ folderUID }: FolderReadmeProps) {
  const styles = useStyles2(getStyles);
  const provisioningEnabled = config.featureToggles.provisioning;

  // Get repository info for the folder
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({
    folderName: folderUID,
  });

  // Construct the README path based on the folder's source path annotation
  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const readmePath = sourcePath ? `${sourcePath}/README.md` : 'README.md';

  // Determine if we should fetch the README
  const shouldFetch = provisioningEnabled && !!repository && !!folderUID && !isRepoLoading;

  // Fetch the README.md file from the repository
  const {
    data: fileData,
    isLoading: isFileLoading,
    isError,
  } = useGetRepositoryFilesWithPathQuery(
    shouldFetch
      ? {
          name: repository.name,
          path: readmePath,
        }
      : skipToken
  );

  // Don't render if provisioning is disabled or folder is not managed
  if (!provisioningEnabled || !folderUID || !repository) {
    return null;
  }

  // Show loading spinner while fetching repository info
  if (isRepoLoading) {
    return null;
  }

  // Show loading spinner while fetching README
  if (isFileLoading) {
    return (
      <Card className={styles.card}>
        <div className={styles.loadingContainer}>
          <Spinner size="sm" />
        </div>
      </Card>
    );
  }

  // Don't render if there was an error (README doesn't exist or unsupported)
  if (isError || !fileData) {
    return null;
  }

  // Extract the raw content from the file data
  // The API returns a ResourceWrapper with resource.file containing the file data
  const fileContent = fileData.resource?.file;
  if (!fileContent) {
    return null;
  }

  // For markdown files, the content might be in different formats depending on how the API returns it
  // Try to get the content as a string
  let markdownContent: string | undefined;

  if (typeof fileContent === 'string') {
    markdownContent = fileContent;
  } else if (typeof fileContent === 'object') {
    // If it's an object, try common property names
    markdownContent =
      (fileContent as Record<string, unknown>).content as string | undefined ||
      (fileContent as Record<string, unknown>).data as string | undefined ||
      (fileContent as Record<string, unknown>).spec as string | undefined;

    // If still not found, try to get raw text if available
    if (!markdownContent && (fileContent as Record<string, unknown>).raw) {
      markdownContent = (fileContent as Record<string, unknown>).raw as string;
    }
  }

  // Don't render if we couldn't extract the content
  if (!markdownContent || typeof markdownContent !== 'string') {
    return null;
  }

  // Render the markdown content
  const renderedHtml = renderMarkdown(markdownContent);

  return (
    <Card className={styles.card}>
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
  }),
  loadingContainer: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(2),
  }),
});
