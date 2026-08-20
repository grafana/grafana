import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIntersection } from 'react-use';

import { type GrafanaTheme2, renderMarkdown, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Dropdown,
  LinkButton,
  Menu,
  Spinner,
  Stack,
  Tab,
  Text,
  ToolbarButton,
  useStyles2,
} from '@grafana/ui';
import { provisioningAPIv0alpha1, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { useFolderDocs } from '../../hooks/useFolderDocs';
import { type FolderReadmeStatus, useFolderReadme } from '../../hooks/useFolderReadme';
import { type FolderDoc, ensureReadmeTab, getDocTabLabel, README_CONVENTION } from '../../utils/folderDocConventions';
import { getRepoEditFileUrl, getRepoNewFileUrl } from '../../utils/git';
import { rewriteRelativeMarkdownLinks } from '../../utils/markdownLinks';

import { FolderReadmeEvents } from './analytics/main';

export const FOLDER_README_ANCHOR_ID = 'folder-readme';

/** Query param that persists the selected doc tab in the URL (by file name). */
export const FOLDER_DOC_TAB_PARAM = 'docTab';

/** Slack subtracted from the tab bar width so rounding never clips the last tab / More. */
const TAB_OVERFLOW_BUFFER_PX = 8;

/** How many tabs after the active one to prefetch so switching feels instant. */
const PREFETCH_ADJACENT_DOCS = 2;

interface Props {
  folderUID: string;
}

/**
 * GitHub-style documentation panel rendered inline below the dashboards list.
 * Markdown files in the folder are promoted into tabs — README, Contributing and
 * Security first, then any other markdown — and tabs that don't fit collapse into
 * a "More" menu. The README renders by default; its pencil opens the host editor.
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
  const { repository, folder, docs: foundDocs, sourceDir, isLoading: isDiscovering } = useFolderDocs(folderUID);

  // Always surface a README tab (first) — synthesized when the file is missing —
  // so its "Add README" affordance and the other tabs stay reachable together.
  const docs = useMemo(() => ensureReadmeTab(foundDocs, sourceDir), [foundDocs, sourceDir]);

  // The active tab lives in the URL so it's deep-linkable and survives reloads.
  // Falls back to the first (highest-priority) doc — README when present.
  const [queryParams, setQueryParams] = useQueryParams();
  const activeTab =
    typeof queryParams[FOLDER_DOC_TAB_PARAM] === 'string' ? queryParams[FOLDER_DOC_TAB_PARAM] : undefined;
  const activeIndex = Math.max(
    0,
    docs.findIndex((doc) => doc.fileName === activeTab)
  );
  const activeDoc = docs[activeIndex];
  const activePath = activeDoc?.path;

  const { status, markdownContent, readmePath, refetch, isFetching } = useFolderReadme(folderUID, activePath);

  // Once the active doc has loaded, warm the next couple of tabs so switching to
  // them is instant. Their content is cached by RTK for later selection.
  usePrefetchAdjacentDocs(repository?.name, docs, activeIndex, status === 'ok');

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

  const selectDoc = (doc: FolderDoc) => {
    setQueryParams({ [FOLDER_DOC_TAB_PARAM]: doc.fileName });
    if (repository) {
      FolderReadmeEvents.tabSelected({ repositoryType: repository.type, doc: doc.key ?? 'other' });
    }
  };

  // The empty "Add README" state only makes sense for the README itself; another
  // doc that fails to load is a load error, not a missing README.
  const isReadmeContext = !activeDoc || activeDoc.key === README_CONVENTION.key;
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
        {/* Switching tabs keeps the previous doc's content on screen (RTK holds
            stale data), so overlay a spinner to signal the new doc is loading. */}
        {!isDiscovering && status === 'ok' && isFetching && (
          <div className={styles.loadingOverlay} data-testid="folder-doc-loading">
            <Spinner size="lg" />
          </div>
        )}
      </div>
    </section>
  );
}

interface DocTabsProps {
  docs: FolderDoc[];
  activePath: string | undefined;
  onSelect: (doc: FolderDoc) => void;
}

/**
 * The GitHub-style tab bar: one tab per markdown doc, in priority order. Tabs
 * that don't fit the available width collapse into a "More" menu, measured
 * against an off-screen copy of the full set (see {@link useDocTabOverflow}).
 * The caller guarantees at least a README tab.
 */
function DocTabs({ docs, activePath, onSelect }: DocTabsProps) {
  const styles = useStyles2(getStyles);
  const [moreOpen, setMoreOpen] = useState(false);
  const { containerRef, measureRef, visibleCount } = useDocTabOverflow(docs.length);

  const visible = docs.slice(0, visibleCount);
  const overflow = docs.slice(visibleCount);
  const overflowActive = overflow.some((doc) => doc.path === activePath);

  return (
    <>
      {/* Off-screen copy of every tab (plus a More trigger) used only to measure
          natural widths. aria-hidden keeps it out of the accessibility tree so
          it isn't double-counted by tab queries. */}
      <div ref={measureRef} className={styles.measure} aria-hidden>
        {docs.map((doc) => (
          <span data-measure-tab key={doc.path}>
            <Tab label={getDocTabLabel(doc)} />
          </span>
        ))}
        <span data-measure-more>
          {/* isOpen={false} so the measured width includes the caret the real
              More trigger renders — otherwise we under-reserve and clip it. */}
          <ToolbarButton isOpen={false}>
            <Trans i18nKey="browse-dashboards.readme.tab-more">More</Trans>
          </ToolbarButton>
        </span>
      </div>

      <div ref={containerRef} className={styles.tabList} role="tablist">
        {visible.map((doc) => (
          <Tab
            key={doc.path}
            label={getDocTabLabel(doc)}
            active={doc.path === activePath}
            onChangeTab={() => onSelect(doc)}
          />
        ))}
        {overflow.length > 0 && (
          <Dropdown
            placement="bottom-start"
            onVisibleChange={setMoreOpen}
            overlay={
              <Menu>
                {overflow.map((doc) => (
                  <Menu.Item
                    key={doc.path}
                    label={getDocTabLabel(doc)}
                    active={doc.path === activePath}
                    onClick={() => onSelect(doc)}
                  />
                ))}
              </Menu>
            }
          >
            <ToolbarButton isOpen={moreOpen} variant={overflowActive ? 'active' : 'default'}>
              <Trans i18nKey="browse-dashboards.readme.tab-more">More</Trans>
            </ToolbarButton>
          </Dropdown>
        )}
      </div>
    </>
  );
}

/**
 * Computes how many doc tabs fit in the tab bar. Measures the natural widths of
 * an off-screen copy of every tab against the visible container's width and,
 * when they overflow, reserves room for the More trigger. Recomputes on resize.
 */
function useDocTabOverflow(docCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(docCount);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) {
      return;
    }

    const recompute = () => {
      const tabEls = Array.from(measure.querySelectorAll<HTMLElement>('[data-measure-tab]'));
      const rawWidth = container.getBoundingClientRect().width;
      // Not laid out yet (or no environment layout, e.g. jsdom): can't measure, so
      // show everything rather than collapse to a single tab.
      if (rawWidth <= 0) {
        setVisibleCount(tabEls.length);
        return;
      }

      // Sub-pixel widths (getBoundingClientRect) and a small buffer keep rounding
      // from clipping the last tab or the More trigger.
      const available = rawWidth - TAB_OVERFLOW_BUFFER_PX;
      const moreEl = measure.querySelector<HTMLElement>('[data-measure-more]');
      const widths = tabEls.map((el) => el.getBoundingClientRect().width);
      const moreWidth = moreEl ? moreEl.getBoundingClientRect().width : 0;

      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total <= available) {
        setVisibleCount(tabEls.length);
        return;
      }

      // Overflowing: reserve space for the More trigger and fit what remains.
      let used = 0;
      let count = 0;
      for (const width of widths) {
        used += width;
        if (used + moreWidth <= available) {
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(1, count));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [docCount]);

  return { containerRef, measureRef, visibleCount };
}

/**
 * Warms the RTK cache for the next {@link PREFETCH_ADJACENT_DOCS} docs after the
 * active one, in parallel, once `enabled` (the active doc has loaded). Prefetched
 * content is cached so selecting those tabs renders without a fetch.
 */
function usePrefetchAdjacentDocs(
  repositoryName: string | undefined,
  docs: FolderDoc[],
  activeIndex: number,
  enabled: boolean
) {
  const prefetchDoc = provisioningAPIv0alpha1.usePrefetch('getRepositoryFilesWithPath');

  useEffect(() => {
    if (!enabled || !repositoryName) {
      return;
    }
    const upcoming = docs.slice(activeIndex + 1, activeIndex + 1 + PREFETCH_ADJACENT_DOCS);
    for (const doc of upcoming) {
      prefetchDoc({ name: repositoryName, path: doc.path });
    }
  }, [enabled, repositoryName, docs, activeIndex, prefetchDoc]);
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
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
  tabList: css({
    // Take the space left by the edit button so overflow is measured against the
    // real available width; tabs that don't fit move into the More menu.
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  }),
  // Off-screen measurement row: laid out (so widths are real) but visually hidden
  // and removed from the accessibility tree.
  measure: css({
    position: 'absolute',
    top: -9999,
    left: -9999,
    display: 'flex',
    alignItems: 'center',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  }),
  body: css({
    position: 'relative',
    padding: theme.spacing(2),
  }),
  // Dims the current doc and centers a spinner while the next doc loads.
  loadingOverlay: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.primary,
    opacity: 0.6,
  }),
});
