import { EditorView } from '@codemirror/view';
import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { fuzzySearch, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneObjectStateChangedEvent, VizPanel } from '@grafana/scenes';
import { Box, FilterInput, ScrollContainer, Sidebar, Text, useStyles2 } from '@grafana/ui';

import { type NotebookScene } from '../NotebookScene';
import { NotebookCellItem } from '../layout-notebook/NotebookCellItem';
import { NOTEBOOK_DOCUMENT_CLASS, type NotebookLayoutManager } from '../layout-notebook/NotebookLayoutManager';
import { NOTEBOOK_CELL_KEY_ATTRIBUTE } from '../layout-notebook/edit/cellClassNames';

import { NotebookOutlineNode, type OutlineSearch } from './NotebookOutlineNode';
import {
  buildNotebookOutline,
  nestNotebookOutline,
  type NotebookOutlineEntry,
  type NotebookOutlineHeadingTarget,
  type NotebookOutlineNode as OutlineTreeNode,
} from './buildNotebookOutline';

// Typing in a cell changes its state on every keystroke; the outline only needs to catch up once it pauses.
const REBUILD_DEBOUNCE_MS = 200;
const ROOT_ID = 'notebook-outline-root';

interface Props {
  scene: NotebookScene;
  /** Height of everything sticky above the document — the app header plus the controls row. */
  stickyTop: number;
  collapsedState: Map<string, boolean>;
}

/**
 * The outline pane, laid out like the dashboard's DashboardOutlineRenderer: header, search, then a tree
 * rooted at the notebook itself.
 */
export function NotebookOutline({ scene, stickyTop, collapsedState }: Props) {
  const { body, title } = scene.useState();

  // Keyed by the layout: a whole-document swap (APPLY_NOTEBOOK_SPEC) hands over a new one, and
  // remounting starts its entries from that layout instead of the one it replaced.
  return (
    <LayoutOutline
      key={body.state.key}
      body={body}
      title={title}
      stickyTop={stickyTop}
      collapsedState={collapsedState}
    />
  );
}

interface LayoutOutlineProps {
  body: NotebookLayoutManager;
  title: string;
  stickyTop: number;
  collapsedState: Map<string, boolean>;
}

function LayoutOutline({ body, title, stickyTop, collapsedState }: LayoutOutlineProps) {
  const styles = useStyles2(getStyles);
  const entries = useOutlineEntries(body);
  const tree = useMemo(() => nestNotebookOutline(entries), [entries]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);
  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const search = useMemo(
    () => (trimmedSearchQuery ? computeOutlineSearch(entries, tree, trimmedSearchQuery) : undefined),
    [entries, tree, trimmedSearchQuery]
  );
  const hasResults = !search || search.matchingIds.size > 0;

  const onSelect = (id: string) => {
    if (id === ROOT_ID) {
      scrollToElement(document.querySelector<HTMLElement>(`.${NOTEBOOK_DOCUMENT_CLASS}`), stickyTop);
      return;
    }
    const entry = entries.find((candidate) => candidate.id === id);
    if (entry) {
      scrollToNotebookEntry(entry, stickyTop);
    }
  };

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('notebook.outline.pane-header', 'Content outline')} />
      <div className={styles.container}>
        <FilterInput
          value={searchQuery}
          onChange={setSearchQuery}
          escapeRegex={false}
          className={styles.input}
          data-testid={selectors.pages.Notebooks.Item.outlineSearchInput}
        />
      </div>
      <ScrollContainer showScrollIndicators={true}>
        <Box
          padding={1}
          gap={0}
          display="flex"
          direction="column"
          element="ul"
          role="tree"
          position="relative"
          aria-label={t('notebook.outline.aria-label', 'Notebook outline')}
          data-testid={selectors.pages.Notebooks.Item.outline}
        >
          {hasResults ? (
            <NotebookOutlineNode
              id={ROOT_ID}
              label={title || t('notebook.outline.tree-item.no-title', '<no title>')}
              icon="gf-notebook"
              childNodes={tree}
              isContainer={true}
              depth={0}
              collapsedState={collapsedState}
              search={search}
              onSelect={onSelect}
            />
          ) : (
            <li className={styles.noResults}>
              <Text color="secondary">
                <Trans i18nKey="notebook.outline.search.no-results">No results found for your query</Trans>
              </Text>
            </li>
          )}
        </Box>
      </ScrollContainer>
    </Box>
  );
}

/**
 * Rebuilt on any state change the outline shows, all of which bubble up to the layout: its cells list
 * (add, remove, reorder), a cell's content, or a panel's title. Content edits set state on the cell,
 * not on the layout, so watching the list alone would miss typing a new heading.
 */
function useOutlineEntries(body: NotebookLayoutManager): NotebookOutlineEntry[] {
  const [entries, setEntries] = useState(() => buildNotebookOutline(body.state.cells));

  useEffect(() => {
    const rebuild = debounce(() => setEntries(buildNotebookOutline(body.state.cells)), REBUILD_DEBOUNCE_MS);
    const subscription = body.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      const { changedObject, partialUpdate } = payload;
      const affectsCells = changedObject === body && 'cells' in partialUpdate;
      const affectsCell =
        changedObject instanceof NotebookCellItem &&
        ('content' in partialUpdate || 'body' in partialUpdate || 'collapsed' in partialUpdate);
      const affectsPanelTitle = changedObject instanceof VizPanel && 'title' in partialUpdate;
      if (affectsCells || affectsCell || affectsPanelTitle) {
        rebuild();
      }
    });

    return () => {
      subscription.unsubscribe();
      rebuild.cancel();
    };
  }, [body]);

  return entries;
}

function computeOutlineSearch(entries: NotebookOutlineEntry[], tree: OutlineTreeNode[], query: string): OutlineSearch {
  const matchingIds = new Set(
    fuzzySearch(
      entries.map((entry) => entry.label),
      query
    ).map((i) => entries[i].id)
  );
  const visibleIds = new Set<string>();

  const markVisible = (node: OutlineTreeNode): boolean => {
    let hasMatchingDescendant = false;
    for (const child of node.children) {
      if (markVisible(child)) {
        hasMatchingDescendant = true;
      }
    }
    if (matchingIds.has(node.entry.id) || hasMatchingDescendant) {
      visibleIds.add(node.entry.id);
      return true;
    }
    return false;
  };
  tree.forEach(markVisible);

  return { matchingIds, visibleIds };
}

/** Lands on the heading itself when it can be found, and on the top of its cell otherwise. */
export function scrollToNotebookEntry(entry: NotebookOutlineEntry, stickyTop: number): void {
  const frames = document.querySelectorAll<HTMLElement>(`[${NOTEBOOK_CELL_KEY_ATTRIBUTE}]`);
  const frame = Array.from(frames).find(
    (candidate) => candidate.getAttribute(NOTEBOOK_CELL_KEY_ATTRIBUTE) === entry.cellKey
  );
  if (!frame) {
    return;
  }
  if (entry.heading && scrollToHeading(frame, entry.label, entry.heading, stickyTop)) {
    return;
  }
  scrollToElement(frame, stickyTop);
}

function scrollToHeading(
  frame: HTMLElement,
  label: string,
  { line, occurrence }: NotebookOutlineHeadingTarget,
  stickyTop: number
): boolean {
  // Editing: the cell is a CodeMirror document. It only draws the lines near the viewport, so the line
  // is found through the editor rather than among its DOM rows.
  const editorDom = frame.querySelector<HTMLElement>('.cm-editor');
  const view = editorDom ? EditorView.findFromDOM(editorDom) : null;
  if (view) {
    if (line >= view.state.doc.lines) {
      return false;
    }
    const pos = view.state.doc.line(line + 1).from;
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: stickyTop }) });
    return true;
  }

  // Reading: the cell is rendered HTML. Matched by text rather than by position, because raw HTML in
  // the markdown can render headings the outline does not list.
  const target = Array.from(frame.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')).filter(
    (element) => normalizeWhitespace(element.textContent ?? '') === normalizeWhitespace(label)
  )[occurrence];
  if (!target) {
    return false;
  }
  scrollToElement(target, stickyTop);
  return true;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The scroll margin is set when jumping rather than in the target's styles: the sticky height varies
 * with the mega menu and the controls row, and only the page knows it.
 */
function scrollToElement(target: HTMLElement | null | undefined, stickyTop: number): void {
  if (!target) {
    return;
  }
  target.style.scrollMarginTop = `${stickyTop}px`;
  target.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(1, 1, 0, 1),
    }),
    input: css({
      width: '100%',
    }),
    noResults: css({
      display: 'flex',
      padding: theme.spacing(1),
    }),
  };
}
