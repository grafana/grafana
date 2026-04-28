import { css } from '@emotion/css';

import { type GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Box, Icon, LinkButton, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';

export const FOLDER_README_ANCHOR_ID = 'folder-readme';

interface Props {
  folderUID: string;
}

/**
 * GitHub-style README panel rendered inline below the dashboards list.
 * Header shows the file name + an Edit pencil that opens the host editor;
 * the body either renders the markdown or shows an "Add README" empty state.
 *
 * Returns null when the feature toggle is off or the folder isn't provisioned.
 */
export function FolderReadmePanel({ folderUID }: Props) {
  const styles = useStyles2(getStyles);
  const { repository, folder, readmePath, isRepoLoading, isFileLoading, isError, fileData } =
    useFolderReadme(folderUID);

  if (!config.featureToggles.provisioningReadmes) {
    return null;
  }

  if (!repository || isRepoLoading) {
    return null;
  }

  const editUrl = getRepoEditFileUrl({
    repoType: repository.type,
    url: repository.url,
    branch: repository.branch,
    filePath: readmePath,
    pathPrefix: repository.path,
  });

  const folderTitle = folder?.spec?.title ?? '';
  const newFileUrl = getRepoNewFileUrl({
    repoType: repository.type,
    url: repository.url,
    branch: repository.branch,
    filePath: readmePath,
    pathPrefix: repository.path,
    template: buildReadmeTemplate(folderTitle),
  });

  const hasReadme = !isError && !!fileData;
  const markdownContent = hasReadme ? extractMarkdownContent(fileData?.resource?.file) : undefined;

  return (
    <section id={FOLDER_README_ANCHOR_ID} className={styles.panel} aria-labelledby={`${FOLDER_README_ANCHOR_ID}-title`}>
      <header className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="file-alt" size="sm" />
          <Text element="h2" variant="bodySmall" weight="medium">
            <span id={`${FOLDER_README_ANCHOR_ID}-title`}>
              {/* The literal filename README.md is the same in every locale; no Trans needed. */}
              {'README.md'}
            </span>
          </Text>
        </Stack>
        {hasReadme && editUrl && (
          <LinkButton
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon="external-link-alt"
            variant="secondary"
            fill="text"
            size="sm"
            tooltip={t('browse-dashboards.readme.edit-tooltip', 'Edit README')}
            aria-label={t('browse-dashboards.readme.edit-tooltip', 'Edit README')}
            onClick={() => {
              reportInteraction('grafana_provisioning_readme_edit_clicked', {
                repositoryType: repository.type,
              });
            }}
          />
        )}
      </header>
      <div className={styles.body}>
        {isFileLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" paddingY={4}>
            <Spinner size="lg" />
          </Box>
        ) : hasReadme && markdownContent ? (
          <RenderedMarkdown markdown={markdownContent} />
        ) : hasReadme ? (
          <Text color="secondary">
            <Trans i18nKey="browse-dashboards.readme.parse-error">Unable to display README content.</Trans>
          </Text>
        ) : (
          <AddReadmeEmptyState newFileUrl={newFileUrl} repositoryType={repository.type} />
        )}
      </div>
    </section>
  );
}

function RenderedMarkdown({ markdown }: { markdown: string }) {
  const html = renderMarkdown(markdown);
  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

function AddReadmeEmptyState({ newFileUrl, repositoryType }: { newFileUrl?: string; repositoryType?: string }) {
  return (
    <Stack direction="column" alignItems="center" gap={2}>
      <Text color="secondary">
        <Trans i18nKey="browse-dashboards.readme.empty-message">
          Add a README to describe what&apos;s in this folder and where to find the right dashboards.
        </Trans>
      </Text>
      {newFileUrl && (
        <LinkButton
          href={newFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          icon="external-link-alt"
          variant="secondary"
          onClick={() => {
            reportInteraction('grafana_provisioning_readme_create_clicked', {
              repositoryType: repositoryType ?? 'unknown',
            });
          }}
        >
          <Trans i18nKey="browse-dashboards.readme.add-readme">Add README</Trans>
        </LinkButton>
      )}
    </Stack>
  );
}

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

function extractMarkdownContent(file: unknown): string | undefined {
  if (!file) {
    return undefined;
  }
  if (typeof file === 'string') {
    return file;
  }
  if (!isStringRecord(file)) {
    return undefined;
  }
  for (const key of ['content', 'data', 'spec', 'raw']) {
    const value = file[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
    scrollMarginTop: theme.spacing(2),
    // Prevent the parent flex column (Page.Contents) from squeezing the
    // panel — without this the body gets cropped on folders with a long list.
    flexShrink: 0,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
  body: css({
    padding: theme.spacing(2),
  }),
});
