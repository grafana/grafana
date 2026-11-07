import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useIntersection } from 'react-use';

import { type GrafanaTheme2, locationUtil, renderMarkdown, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button, LinkButton, Spinner, Stack, Tab, TabsBar, Text, useStyles2 } from '@grafana/ui';
import { type RepositoryView, useLookupRepositoryPathsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { useMermaidDiagrams } from 'app/core/hooks/useMermaidDiagrams';
import { DIAGRAM_CLASS } from 'app/core/utils/mermaid';

import { useFolderDocs } from '../../hooks/useFolderDocs';
import { type FolderReadmeStatus, useFolderReadme } from '../../hooks/useFolderReadme';
import { type FolderDoc, FOLDER_DOC_TAB_PARAM, getDocTabLabel } from '../../utils/folderDocConventions';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';
import { splitFrontmatter } from '../../utils/markdownFrontmatter';
import { RESOURCE_PATH_ATTR, RESOURCE_ROUTE_ATTR, rewriteRelativeMarkdownLinks } from '../../utils/markdownLinks';
import { resolveMarkdownResourceLinks } from '../../utils/markdownResourceLinks';
import { splitPath } from '../utils/path';

import { MarkdownFrontmatterTable } from './MarkdownFrontmatterTable';
import { FolderReadmeEvents } from './analytics/main';

export const FOLDER_README_ANCHOR_ID = 'folder-readme';

interface Props {
  folderUID: string;
}

/**
 * GitHub-style documentation panel rendered inline below the dashboards list.
 * Markdown files in the folder are promoted into tabs — README, Contributing and
 * Security first, then any other markdown. The README renders by default; its
 * pencil opens the host editor.
 *
 * Switching folders remounts the content so per-folder state (analytics, tab
 * selection) never carries across.
 *
 * Returns null when a loaded folder isn't provisioned; shows a spinner while loading.
 */
export function FolderReadmePanel({ folderUID }: Props) {
  return <FolderReadmePanelContent key={folderUID} folderUID={folderUID} />;
}

function FolderReadmePanelContent({ folderUID }: Props) {
  const styles = useStyles2(getStyles);
  const { repository, folder, docs, isLoading: isDiscovering } = useFolderDocs(folderUID);

  // The active tab lives in the URL so it's deep-linkable and survives reloads.
  // Falls back to the first doc, which is always the README.
  // Matched case-insensitively like doc discovery: a README can link a doc by a
  // name cased differently to the file, and the link carries the name as written.
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get(FOLDER_DOC_TAB_PARAM)?.toLowerCase();
  const activeIndex = Math.max(
    0,
    docs.findIndex((doc) => doc.fileName.toLowerCase() === activeTab)
  );
  const activeDoc = docs[activeIndex];

  const { status, markdownContent, refetch, syncFinished } = useFolderReadme(repository?.name, activeDoc.path);

  const sectionRef = useRef<HTMLElement>(null);
  // TODO remove when react-use is fixed
  // see https://github.com/streamich/react-use/issues/2612
  // @ts-expect-error
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

  // Tabs are links (`?docTab=<file>`), so navigation is handled by the app's
  // global link interception; the click handler only reports analytics. The href
  // carries the app sub-path so open-in-new-tab / copy-link work on subpath installs.
  const tabHref = (doc: FolderDoc) => locationUtil.getUrlForPartial(location, { [FOLDER_DOC_TAB_PARAM]: doc.fileName });
  const reportTabSelected = (doc: FolderDoc) => {
    if (repository) {
      FolderReadmeEvents.tabSelected({ repositoryType: repository.type, doc: doc.key ?? 'other' });
    }
  };

  const hostFile = repository && {
    repoType: repository.type,
    url: repository.url,
    branch: repository.branch,
    filePath: activeDoc.path,
    pathPrefix: repository.path,
  };
  const editUrl = hostFile && getRepoEditFileUrl(hostFile);
  const newFileUrl =
    hostFile && getRepoNewFileUrl({ ...hostFile, template: buildReadmeTemplate(folder?.spec?.title ?? '') });

  return (
    <section
      ref={sectionRef}
      id={FOLDER_README_ANCHOR_ID}
      className={styles.panel}
      aria-label={t('browse-dashboards.readme.panel-label', 'Folder documentation')}
    >
      <header className={styles.header}>
        <TabsBar hideBorder className={styles.tabs}>
          {docs.map((doc) => (
            <Tab
              key={doc.path}
              label={getDocTabLabel(doc)}
              active={doc.path === activeDoc.path}
              href={tabHref(doc)}
              onChangeTab={() => reportTabSelected(doc)}
            />
          ))}
        </TabsBar>
        {status === 'ok' && editUrl && (
          <LinkButton
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon="pen"
            variant="secondary"
            fill="text"
            size="sm"
            tooltip={t('browse-dashboards.readme.edit-doc-tooltip', 'Edit document')}
            aria-label={t('browse-dashboards.readme.edit-doc-tooltip', 'Edit document')}
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
          doc={activeDoc}
          newFileUrl={newFileUrl}
          refetch={refetch}
          syncFinished={syncFinished}
        />
      </div>
    </section>
  );
}

interface ReadmeBodyProps {
  status: FolderReadmeStatus;
  markdownContent: string | undefined;
  repository: RepositoryView | undefined;
  doc: FolderDoc;
  newFileUrl: string | undefined;
  refetch: () => void;
  syncFinished: number | undefined;
}

function ReadmeBody({ status, markdownContent, repository, doc, newFileUrl, refetch, syncFinished }: ReadmeBodyProps) {
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
        // Remount across repositories so pending lookups cannot cross repository boundaries.
        <RenderedMarkdown
          key={repository.name}
          markdown={markdownContent}
          repository={repository}
          baseDirInRepo={getDocBaseDir(repository.path, doc.path)}
          repositoryType={repository.type}
          syncFinished={syncFinished}
        />
      ) : (
        <Text color="secondary">
          <Trans i18nKey="browse-dashboards.readme.parse-error">Unable to display this document.</Trans>
        </Text>
      );
    case 'missing':
      // The "Add README" prompt only makes sense for the README itself; any other
      // doc came from the file listing, so a 404 is a load failure.
      return doc.key === 'readme' ? (
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
  syncFinished,
}: {
  markdown: string;
  repository: RepositoryView;
  baseDirInRepo: string;
  repositoryType: RepositoryView['type'];
  syncFinished: number | undefined;
}) {
  const styles = useStyles2(getStyles);
  const [fetchResources] = useLookupRepositoryPathsMutation();

  // The parent re-renders on every intersection change; keep marked and the
  // sanitizer off the scroll path.
  const { frontmatter, safe } = useMemo(() => {
    // Front matter isn't markdown: left in, marked turns the `---` fences into an
    // <hr> and a heading. Show it as a metadata table instead, like GitHub does.
    const { frontmatter, body } = splitFrontmatter(markdown);

    // renderMarkdown's default sanitizer strips the href of bare relative links
    // (e.g. `dashboard.json`, `subfolder/`), leaving `<a href>` that resolves to
    // the app root — so folder/dashboard links can't be rewritten or resolved.
    // Render without it and rely on textUtil.sanitize (the XSS boundary), which
    // preserves relative links.
    const html = renderMarkdown(body, { noSanitize: true });
    const rewritten = rewriteRelativeMarkdownLinks(html, { repository, baseDirInRepo });
    return { frontmatter, safe: textUtil.sanitize(rewritten) };
  }, [markdown, repository, baseDirInRepo]);
  const source = useMemo(
    () => ({ html: safe, repositoryName: repository.name, repositoryPath: repository.path, syncFinished }),
    [safe, repository.name, repository.path, syncFinished]
  );
  const [resolved, setResolved] = useState<{ source: typeof source; html: string }>();
  const rendered = useMemo(
    () => (resolved?.source === source ? textUtil.sanitize(resolved.html) : safe),
    [resolved, source, safe]
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!source.html.includes(RESOURCE_PATH_ATTR)) {
      return;
    }
    let active = true;
    const requests: Array<{ abort: () => void }> = [];
    void resolveMarkdownResourceLinks(
      source.html,
      (paths) => {
        if (!active) {
          return Promise.reject(new Error('Markdown lookup cancelled'));
        }
        const request = fetchResources({ name: source.repositoryName, paths });
        requests.push(request);
        return request.unwrap();
      },
      source.repositoryPath
    )
      .then((html) => {
        if (active) {
          setResolved({ source, html });
        }
      })
      .catch(() => {
        // A failed lookup must not hide the document or break its host links.
      });
    return () => {
      active = false;
      requests.forEach((request) => request.abort());
    };
  }, [source, fetchResources]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) {
        return;
      }
      const anchor = e.target.closest('a');
      const href = anchor?.getAttribute('href');
      if (!href) {
        return;
      }
      const route = anchor?.getAttribute(RESOURCE_ROUTE_ATTR);
      const plainClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
      if (route && plainClick) {
        e.preventDefault();
        locationService.push(route);
      }
      FolderReadmeEvents.linkClicked({ repositoryType, outcome: route ? 'in_app' : 'host' });
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [repositoryType]);

  // React resets innerHTML whenever this object's identity changes, which would
  // wipe the diagrams the hook swapped in — so only hand it a new one when the html changes.
  const innerHtml = useMemo(() => ({ __html: rendered }), [rendered]);
  useMermaidDiagrams(containerRef, rendered);

  // The metadata table sits outside the markdown container so the link-click
  // handler and the mermaid hook only ever see rendered markdown.
  return (
    <>
      {frontmatter && <MarkdownFrontmatterTable data={frontmatter} />}
      <div
        ref={containerRef}
        className={cx('markdown-html', styles.markdownBody)}
        dangerouslySetInnerHTML={innerHtml}
      />
    </>
  );
}

/**
 * The doc's containing directory inside the host repo:
 *   `{repository.path}/{dirname(docPath)}` with all empty segments dropped.
 * Used as the base for resolving relative links inside the markdown.
 */
function getDocBaseDir(repositoryPath: string | undefined, docPath: string): string {
  return [repositoryPath ?? '', splitPath(docPath).directory].filter(Boolean).join('/');
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
    <Alert severity="warning" title={t('browse-dashboards.readme.load-error-title', "Couldn't load this document")}>
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
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
  // Take the space left by the edit button; TabsBar scrolls horizontally when
  // the tabs don't fit.
  tabs: css({
    flex: 1,
    minWidth: 0,
  }),
  body: css({
    padding: theme.spacing(2),
  }),
  // README diagrams are centered like on GitHub; the text panel keeps them left-aligned.
  markdownBody: css({
    [`.${DIAGRAM_CLASS}`]: {
      display: 'flex',
      justifyContent: 'center',
    },
  }),
});
