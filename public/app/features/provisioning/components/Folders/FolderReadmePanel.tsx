import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useRef } from 'react';
import { useIntersection } from 'react-use';

import { type GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type FolderReadmeStatus, useFolderReadme } from '../../hooks/useFolderReadme';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';
import { rewriteRelativeMarkdownLinks } from '../../utils/markdownLinks';

import { FolderReadmeEvents } from './analytics/main';

export const FOLDER_README_ANCHOR_ID = 'folder-readme';

interface Props {
  folderUID: string;
}

/**
 * GitHub-style README panel rendered inline below the dashboards list.
 * Header shows the file name + an Edit pencil that opens the host editor;
 * the body either renders the markdown or shows an "Add README" empty state.
 *
 * Returns null and triggers no data fetching when the `provisioning.readmes`
 * OpenFeature toggle is off or when the folder isn't provisioned.
 */
export function FolderReadmePanel({ folderUID }: Props) {
  const provisioningReadmesEnabled = useBooleanFlagValue('provisioning.readmes', false);
  if (!provisioningReadmesEnabled) {
    return null;
  }
  return <FolderReadmePanelContent folderUID={folderUID} />;
}

function FolderReadmePanelContent({ folderUID }: Props) {
  const styles = useStyles2(getStyles);
  const { repository, folder, readmePath, status, markdownContent, refetch } = useFolderReadme(folderUID);

  const sectionRef = useRef<HTMLElement>(null);
  const intersection = useIntersection(sectionRef, { threshold: 0.5 });
  const reportedStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!repository || status === 'loading') {
      return;
    }
    if (!intersection?.isIntersecting) {
      return;
    }
    if (reportedStatusRef.current === status) {
      return;
    }
    reportedStatusRef.current = status;
    FolderReadmeEvents.panelViewed({ repositoryType: repository.type, status });
  }, [intersection, repository, status]);

  if (!repository || status === 'loading') {
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

  return (
    <section
      ref={sectionRef}
      id={FOLDER_README_ANCHOR_ID}
      className={styles.panel}
      aria-labelledby={`${FOLDER_README_ANCHOR_ID}-title`}
    >
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
        {status === 'ok' && editUrl && (
          <LinkButton
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon="pen"
            variant="secondary"
            fill="text"
            size="sm"
            tooltip={t('browse-dashboards.readme.edit-tooltip', 'Edit README')}
            aria-label={t('browse-dashboards.readme.edit-tooltip', 'Edit README')}
            onClick={() => {
              FolderReadmeEvents.editClicked({ repositoryType: repository.type });
            }}
          />
        )}
      </header>
      <div className={styles.body}>
        <ReadmeBody
          status={status}
          markdownContent={markdownContent}
          repository={repository}
          readmePath={readmePath}
          newFileUrl={newFileUrl}
          refetch={refetch}
        />
      </div>
    </section>
  );
}

interface ReadmeBodyProps {
  status: Exclude<FolderReadmeStatus, 'loading'>;
  markdownContent: string | undefined;
  repository: RepositoryView;
  readmePath: string;
  newFileUrl: string | undefined;
  refetch: () => void;
}

function ReadmeBody({ status, markdownContent, repository, readmePath, newFileUrl, refetch }: ReadmeBodyProps) {
  switch (status) {
    case 'ok':
      return markdownContent !== undefined ? (
        <RenderedMarkdown
          markdown={markdownContent}
          repository={repository}
          baseDirInRepo={getReadmeBaseDir(repository.path, readmePath)}
          repositoryType={repository.type}
        />
      ) : (
        <Text color="secondary">
          <Trans i18nKey="browse-dashboards.readme.parse-error">Unable to display README content.</Trans>
        </Text>
      );
    case 'missing':
      return <AddReadmeEmptyState newFileUrl={newFileUrl} repositoryType={repository.type} />;
    case 'error':
      return <ReadmeLoadError onRetry={refetch} repositoryType={repository.type} />;
  }
}

function RenderedMarkdown({
  markdown,
  repository,
  baseDirInRepo,
  repositoryType,
}: {
  markdown: string;
  repository: RepositoryView;
  baseDirInRepo: string;
  repositoryType: RepositoryView['type'];
}) {
  const html = renderMarkdown(markdown);
  const rewritten = rewriteRelativeMarkdownLinks(html, { repository, baseDirInRepo });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('a')) {
        FolderReadmeEvents.linkClicked({ repositoryType });
      }
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [repositoryType]);

  return <div ref={containerRef} className="markdown-html" dangerouslySetInnerHTML={{ __html: rewritten }} />;
}

/**
 * The README's containing directory inside the host repo:
 *   `{repository.path}/{dirname(readmePath)}` with all empty segments dropped.
 * Used as the base for resolving relative links inside the markdown.
 */
function getReadmeBaseDir(repositoryPath: string | undefined, readmePath: string): string {
  const lastSlash = readmePath.lastIndexOf('/');
  const readmeDir = lastSlash >= 0 ? readmePath.slice(0, lastSlash) : '';
  return [repositoryPath ?? '', readmeDir].filter(Boolean).join('/');
}

function AddReadmeEmptyState({
  newFileUrl,
  repositoryType,
}: {
  newFileUrl?: string;
  repositoryType: RepositoryView['type'];
}) {
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
            FolderReadmeEvents.createClicked({ repositoryType });
          }}
        >
          <Trans i18nKey="browse-dashboards.readme.add-readme">Add README</Trans>
        </LinkButton>
      )}
    </Stack>
  );
}

function ReadmeLoadError({ onRetry, repositoryType }: { onRetry: () => void; repositoryType: RepositoryView['type'] }) {
  return (
    <Alert severity="warning" title={t('browse-dashboards.readme.load-error-title', "Couldn't load README")}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          FolderReadmeEvents.retryClicked({ repositoryType });
          onRetry();
        }}
      >
        <Trans i18nKey="browse-dashboards.readme.load-error-retry">Try again</Trans>
      </Button>
    </Alert>
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
