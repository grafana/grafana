import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useRef } from 'react';
import { useIntersection } from 'react-use';

import { type GrafanaTheme2, renderMarkdown, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button, Icon, LinkButton, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import {
  type RepositoryView,
  type ResourceListItem,
  useLazyGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { type FolderReadmeStatus, useFolderReadme } from '../../hooks/useFolderReadme';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';
import { RESOURCE_PATH_ATTR, rewriteRelativeMarkdownLinks } from '../../utils/markdownLinks';
import { createGrafanaLinkResolver } from '../../utils/markdownResourceLinks';

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
  const { repository, folder, readmePath, status, isLoading, markdownContent, refetch } = useFolderReadme(folderUID);

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

  if (!isLoading && !repository) {
    return null;
  }

  const editUrl = repository
    ? getRepoEditFileUrl({
        repoType: repository.type,
        url: repository.url,
        branch: repository.branch,
        filePath: readmePath,
        pathPrefix: repository.path,
      })
    : undefined;

  const folderTitle = folder?.spec?.title ?? '';
  const newFileUrl = repository
    ? getRepoNewFileUrl({
        repoType: repository.type,
        url: repository.url,
        branch: repository.branch,
        filePath: readmePath,
        pathPrefix: repository.path,
        template: buildReadmeTemplate(folderTitle),
      })
    : undefined;

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
              repository && FolderReadmeEvents.editClicked({ repositoryType: repository.type });
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
  status: FolderReadmeStatus;
  markdownContent: string | undefined;
  repository: RepositoryView | undefined;
  readmePath: string;
  newFileUrl: string | undefined;
  refetch: () => void;
}

function ReadmeBody({ status, markdownContent, repository, readmePath, newFileUrl, refetch }: ReadmeBodyProps) {
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
  // Links to JSON/YAML files or folders are tagged during rewrite; the resource
  // listing is fetched lazily only when the user actually clicks one of them.
  const [fetchResources] = useLazyGetRepositoryResourcesQuery();
  const repositoryName = repository.name;
  const repositoryPath = repository.path;

  const html = renderMarkdown(markdown);
  const rewritten = rewriteRelativeMarkdownLinks(html, { repository, baseDirInRepo });
  const safe = textUtil.sanitize(rewritten);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    // Resolve a tagged link to its in-app Grafana page, falling back to the host
    // URL on the anchor when it has no matching resource or the lookup fails.
    const resolveAndNavigate = async (anchor: HTMLAnchorElement, repoPath: string) => {
      let items: ResourceListItem[] = [];
      try {
        const result = await fetchResources({ name: repositoryName }, true).unwrap();
        items = result.items ?? [];
      } catch {
        // Ignore — fall back to the host link below.
      }
      const route = createGrafanaLinkResolver(items, repositoryPath)(repoPath);
      if (route) {
        locationService.push(route);
        return;
      }
      const href = anchor.getAttribute('href');
      if (!href) {
        return;
      }
      // Default navigation was already suppressed on click; open the host link
      // ourselves. A delayed window.open can be popup-blocked (no longer counted
      // as user-initiated), so fall back to same-tab navigation to guarantee the
      // click still goes somewhere.
      if (!window.open(href, '_blank', 'noopener,noreferrer')) {
        window.location.assign(href);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        return;
      }
      const anchor = e.target.closest('a');
      if (!anchor) {
        return;
      }
      FolderReadmeEvents.linkClicked({ repositoryType });

      const repoPath = anchor.getAttribute(RESOURCE_PATH_ATTR);
      // Only JSON/YAML/folder links carry the attribute. Leave modified/middle
      // clicks to the browser so "open in new tab" keeps hitting the host URL.
      if (!repoPath || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      e.preventDefault();
      void resolveAndNavigate(anchor, repoPath);
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [repositoryType, repositoryName, repositoryPath, fetchResources]);

  return <div ref={containerRef} className="markdown-html" dangerouslySetInnerHTML={{ __html: safe }} />;
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
