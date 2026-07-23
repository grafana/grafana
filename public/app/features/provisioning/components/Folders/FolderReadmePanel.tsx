import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useRef, useState } from 'react';
import { useIntersection } from 'react-use';

import { type GrafanaTheme2, renderMarkdown, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LinkButton, Spinner, Stack, Tab, Text, useStyles2 } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { useFolderDocs } from '../../hooks/useFolderDocs';
import { type FolderReadmeStatus, useFolderReadme } from '../../hooks/useFolderReadme';
import { type FolderDocMatch, getFolderDocLabel, README_CONVENTION } from '../../utils/folderDocConventions';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';
import { rewriteRelativeMarkdownLinks } from '../../utils/markdownLinks';

import { FolderReadmeEvents } from './analytics/main';

export const FOLDER_README_ANCHOR_ID = 'folder-readme';

interface Props {
  folderUID: string;
}

/**
 * GitHub-style documentation panel rendered inline below the dashboards list.
 * Recognized convention files (README, ARCHITECTURE, RUNBOOK, …) are promoted
 * into tabs, with lower-priority docs collapsed into a "More" menu when the bar
 * gets crowded. The README renders by default; its pencil opens the host editor.
 *
 * Returns null when the `provisioning.readmes` toggle is off or a loaded folder
 * isn't provisioned; shows a spinner while loading.
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
  const { repository, folder, docs, isLoading: isDiscovering } = useFolderDocs(folderUID);

  // The active doc is UI state; default to the README (or the highest-priority
  // doc when there is no README) once discovery resolves.
  const [activePath, setActivePath] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (docs.length === 0) {
      return;
    }
    // Keep the current selection if it still exists, otherwise fall back to the
    // first (highest-priority) doc — README when present.
    if (!docs.some((doc) => doc.path === activePath)) {
      setActivePath(docs[0].path);
    }
  }, [docs, activePath]);

  const activeDoc = docs.find((doc) => doc.path === activePath);
  const { status, markdownContent, readmePath, refetch } = useFolderReadme(folderUID, activePath);

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

  if (!isDiscovering && !repository) {
    return null;
  }

  const selectDoc = (doc: FolderDocMatch) => {
    setActivePath(doc.path);
    if (repository) {
      FolderReadmeEvents.tabSelected({ repositoryType: repository.type, doc: doc.convention.key });
    }
  };

  // The empty "Add README" state only makes sense for the README itself; a
  // recognized doc that fails to load is a load error, not a missing README.
  const isReadmeContext = !activeDoc || activeDoc.convention.key === README_CONVENTION.key;
  const activeFileName = activeDoc?.fileName ?? README_CONVENTION.fileName;

  const editUrl = repository
    ? getRepoEditFileUrl({
        repoType: repository.type,
        url: repository.url,
        branch: repository.branch,
        filePath: readmePath,
        pathPrefix: repository.path,
      })
    : undefined;

  const newFileUrl = repository
    ? getRepoNewFileUrl({
        repoType: repository.type,
        url: repository.url,
        branch: repository.branch,
        filePath: readmePath,
        pathPrefix: repository.path,
        template: buildReadmeTemplate(folder?.spec?.title ?? ''),
      })
    : undefined;

  return (
    <section
      ref={sectionRef}
      id={FOLDER_README_ANCHOR_ID}
      className={styles.panel}
      aria-label={t('browse-dashboards.readme.panel-label', 'Folder documentation')}
    >
      <header className={styles.header}>
        <DocTabs docs={docs} activePath={activePath} onSelect={selectDoc} />
        {status === 'ok' && editUrl && (
          <LinkButton
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon="pen"
            variant="secondary"
            fill="text"
            size="sm"
            tooltip={t('browse-dashboards.readme.edit-doc-tooltip', 'Edit {{name}}', { name: activeFileName })}
            aria-label={t('browse-dashboards.readme.edit-doc-tooltip', 'Edit {{name}}', { name: activeFileName })}
            onClick={() => {
              repository && FolderReadmeEvents.editClicked({ repositoryType: repository.type });
            }}
          />
        )}
      </header>
      <div className={styles.body}>
        <ReadmeBody
          status={isDiscovering ? 'loading' : status}
          markdownContent={markdownContent}
          repository={repository}
          readmePath={readmePath}
          newFileUrl={newFileUrl}
          isReadmeContext={isReadmeContext}
          refetch={refetch}
        />
      </div>
    </section>
  );
}

interface DocTabsProps {
  docs: FolderDocMatch[];
  activePath: string | undefined;
  onSelect: (doc: FolderDocMatch) => void;
}

/**
 * The GitHub-style tab bar: one tab per recognized convention doc, ordered as
 * GitHub orders them. While discovery is still running (no docs yet) a single
 * static README tab stands in so the panel chrome doesn't jump.
 */
function DocTabs({ docs, activePath, onSelect }: DocTabsProps) {
  const styles = useStyles2(getStyles);

  if (docs.length === 0) {
    return (
      <div className={styles.tabList} role="tablist">
        <Tab label={getFolderDocLabel(README_CONVENTION.key)} active />
      </div>
    );
  }

  return (
    <div className={styles.tabList} role="tablist">
      {docs.map((doc) => (
        <Tab
          key={doc.path}
          label={getFolderDocLabel(doc.convention.key)}
          active={doc.path === activePath}
          onChangeTab={() => onSelect(doc)}
        />
      ))}
    </div>
  );
}

interface ReadmeBodyProps {
  status: FolderReadmeStatus;
  markdownContent: string | undefined;
  repository: RepositoryView | undefined;
  readmePath: string;
  newFileUrl: string | undefined;
  isReadmeContext: boolean;
  refetch: () => void;
}

function ReadmeBody({
  status,
  markdownContent,
  repository,
  readmePath,
  newFileUrl,
  isReadmeContext,
  refetch,
}: ReadmeBodyProps) {
  if (status === 'loading' || !repository) {
    return (
      <Stack justifyContent="center">
        <Spinner size="lg" />
      </Stack>
    );
  }
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
      // A recognized doc that 404s is a load failure, not a missing README.
      return isReadmeContext ? (
        <AddReadmeEmptyState newFileUrl={newFileUrl} repositoryType={repository.type} />
      ) : (
        <ReadmeLoadError onRetry={refetch} repositoryType={repository.type} />
      );
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
  const safe = textUtil.sanitize(rewritten);
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

  return <div ref={containerRef} className="markdown-html" dangerouslySetInnerHTML={{ __html: safe }} />;
}

/**
 * The doc's containing directory inside the host repo:
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
    padding: theme.spacing(0, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
  tabList: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflowX: 'auto',
  }),
  body: css({
    padding: theme.spacing(2),
  }),
});
