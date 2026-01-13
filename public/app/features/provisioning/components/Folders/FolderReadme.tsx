import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Spinner, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

interface FolderReadmeContentProps {
  folderUID: string;
}

/**
 * FolderReadmeContent fetches and renders a README.md file from a Git Sync provisioned folder.
 * This is the main content component used in the README tab.
 */
export function FolderReadmeContent({ folderUID }: FolderReadmeContentProps) {
  const styles = useStyles2(getStyles);

  // Get repository info for the folder
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({
    folderName: folderUID,
  });

  // Construct the README path based on the folder's source path annotation
  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const readmePath = sourcePath ? `${sourcePath}/README.md` : 'README.md';

  // Determine if we should fetch the README
  const shouldFetch = !!repository && !!folderUID && !isRepoLoading;

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

  // Show loading spinner while fetching repository info or README
  if (isRepoLoading || isFileLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" paddingY={4}>
        <Spinner size="lg" />
      </Box>
    );
  }

  // Show empty state if folder is not managed by a repository
  if (!repository) {
    return (
      <Box paddingY={4}>
        <Stack direction="column" alignItems="center" gap={2}>
          <Text color="secondary">
            <Trans i18nKey="browse-dashboards.readme.not-provisioned">
              This folder is not managed by a Git repository.
            </Trans>
          </Text>
        </Stack>
      </Box>
    );
  }

  // Show empty state if there was an error or no README exists
  if (isError || !fileData) {
    return (
      <Box paddingY={4}>
        <Stack direction="column" alignItems="center" gap={2}>
          <Text color="secondary">
            <Trans i18nKey="browse-dashboards.readme.not-found">
              No README.md file found in this folder.
            </Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="browse-dashboards.readme.add-hint">
              Add a README.md file to your repository to display documentation here.
            </Trans>
          </Text>
        </Stack>
      </Box>
    );
  }

  // Extract the raw content from the file data
  const fileContent = fileData.resource?.file;
  if (!fileContent) {
    return null;
  }

  // Try to get the content as a string
  let markdownContent: string | undefined;

  if (typeof fileContent === 'string') {
    markdownContent = fileContent;
  } else if (typeof fileContent === 'object') {
    markdownContent =
      (fileContent as Record<string, unknown>).content as string | undefined ||
      (fileContent as Record<string, unknown>).data as string | undefined ||
      (fileContent as Record<string, unknown>).spec as string | undefined;

    if (!markdownContent && (fileContent as Record<string, unknown>).raw) {
      markdownContent = (fileContent as Record<string, unknown>).raw as string;
    }
  }

  if (!markdownContent || typeof markdownContent !== 'string') {
    return (
      <Box paddingY={4}>
        <Text color="secondary">
          <Trans i18nKey="browse-dashboards.readme.parse-error">
            Unable to display README content.
          </Trans>
        </Text>
      </Box>
    );
  }

  // Render the markdown content
  const renderedHtml = renderMarkdown(markdownContent);

  return (
    <div className={styles.container}>
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
  }),
});

// Keep the old export for backwards compatibility during transition
export { FolderReadmeContent as FolderReadme };
