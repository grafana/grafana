import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { lazy, Suspense, useEffect, useMemo, useRef, type MouseEvent } from 'react';

import { type GrafanaTheme2, renderTextPanelMarkdown } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { useFocusExtension } from './focusExtension';
import { addHeadingIds, headingIdFromHash } from './markdownHeadingAnchors';
import { headingBoldWeight, headingStyles } from './markdownHeadingStyles';

const MarkdownCellEditor = lazy(() =>
  import(/* webpackChunkName: "notebook-markdown-editor" */ './MarkdownCellEditor').then((m) => ({
    default: m.MarkdownCellEditor,
  }))
);

/**
 * Tracks the URL fragment that arrived via initial page load / route navigation so it is restored
 * only once to its target heading. Subsequent cell mounts or edit-mode toggles within the same
 * route will not treat the URL fragment as a fresh deep link and steal scroll position.
 *
 * Reset whenever the pathname changes, so client-side navigation to another notebook restores its
 * own deep link fragment.
 */
let restoredPathAndHash: { pathname: string; hash: string } | null = null;

let unlistenHistory: (() => void) | null = null;
let lastKnownLocationService: typeof locationService | null = null;

function ensureHistoryListener() {
  if (unlistenHistory && lastKnownLocationService === locationService) {
    return;
  }
  if (unlistenHistory) {
    unlistenHistory();
  }
  lastKnownLocationService = locationService;
  unlistenHistory = locationService.getHistory().listen((location) => {
    // If the path changed (e.g. navigated to another notebook), reset the restored state so the
    // new page's deep link fragment can be restored when its cells mount.
    if (restoredPathAndHash && location.pathname !== restoredPathAndHash.pathname) {
      restoredPathAndHash = null;
    }
  });
}

export function resetInitialHashRestorationForTests() {
  restoredPathAndHash = null;
  if (unlistenHistory) {
    unlistenHistory();
    unlistenHistory = null;
  }
  lastKnownLocationService = null;
}

export interface MarkdownCellProps {
  content: CellContentKind;
  isEditing: boolean;
  autoFocus?: boolean;
  focusRequestId?: number;
  caretOffset?: number;
  /** Which edge of the cell to reveal on that same grant — see useFocusExtension's own doc comment. */
  scrollAlign?: ScrollLogicalPosition;
  onChange: (content: CellContentKind) => void;
  placeholder?: string;
  onSubmit?: (remainder: string, marker?: string) => void;
  /** ArrowUp/ArrowDown once the caret has nowhere further to go inside this cell. See navigationKeymap. */
  onNavigate?: (direction: 'up' | 'down') => void;
}

export function MarkdownCell({
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  scrollAlign,
  onChange,
  placeholder,
  onSubmit,
  onNavigate,
}: MarkdownCellProps) {
  const styles = useStyles2(getStyles);
  const focusExtension = useFocusExtension({
    autoFocus,
    isEditing,
    focusRequestId,
    caretOnFocus: caretOffset,
    scrollAlign,
  });
  const html = useMemo(
    () => (content.kind === 'Markdown' ? addHeadingIds(renderTextPanelMarkdown(content.spec.text)) : ''),
    [content]
  );
  useEffect(() => {
    ensureHistoryListener();

    // Restores the fragment once its target heading exists in the DOM. Subsequent renders or newly
    // mounted/uncollapsed cells will not steal scroll if the fragment for this pathname has already been restored.
    const { pathname, hash: routerHash } = locationService.getLocation();
    const hash = routerHash || window.location.hash;
    if (isEditing || !hash) {
      return;
    }

    if (restoredPathAndHash && restoredPathAndHash.pathname === pathname && restoredPathAndHash.hash === hash) {
      return;
    }

    const id = headingIdFromHash(hash);
    if (id && document.getElementById(id)) {
      restoredPathAndHash = { pathname, hash };
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    }
  }, [isEditing]);

  if (content.kind !== 'Markdown') {
    return null;
  }

  if (!isEditing) {
    if (!html) {
      return null;
    }
    return (
      <DangerouslySetHtmlContent
        html={html}
        className={cx('markdown-html', styles.markdown)}
        onClick={handleAnchorClick}
      />
    );
  }

  return (
    <Suspense fallback={<LoadingPlaceholder text={t('notebook.cell.markdown.loading-editor', 'Loading editor')} />}>
      <MarkdownCellEditor
        content={content}
        onChange={onChange}
        placeholder={placeholder}
        onSubmit={onSubmit}
        onNavigate={onNavigate}
        focusExtension={focusExtension}
      />
    </Suspense>
  );
}

/**
 * Jumps to the heading a table-of-contents link names, smoothly. The target may be in another cell,
 * so it is looked up in the document rather than inside this cell. Handling the click here also
 * keeps Grafana's global link interceptor from turning the hash into an instant jump.
 */
function handleAnchorClick(event: MouseEvent<HTMLDivElement>) {
  const anchor = event.target instanceof Element ? event.target.closest('a') : null;
  const id = headingIdFromHash(anchor?.getAttribute('href') ?? '');
  if (!id) {
    return;
  }

  const destination = document.getElementById(id);
  if (!destination) {
    return;
  }

  event.preventDefault();
  destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Mark as restored so subsequent cell mounts or edit-mode toggles won't re-trigger a jump to this heading.
  restoredPathAndHash = { pathname: locationService.getLocation().pathname, hash: `#${id}` };
  // Through locationService, not window.history: the router has to see the fragment, or its next
  // url update starts from a location without it and drops it. Path and search come along so the
  // replace keeps the notebook's time range instead of resolving to a bare hash.
  const { pathname, search } = locationService.getLocation();
  locationService.replace({ pathname, search, hash: `#${id}` });
}

const getStyles = (theme: GrafanaTheme2) => ({
  markdown: css({
    'h1, h2, h3, h4, h5, h6': {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      // Clears the sticky controls row when a contents link scrolls a heading to the top, same
      // allowance the cell frames make for focus scrolling.
      scrollMarginTop: theme.spacing(14),
    },
    '& > :first-child': {
      marginTop: 0,
    },
    h1: headingStyles(theme.typography.h1),
    h2: {
      ...headingStyles(theme.typography.h2),
      paddingBottom: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    h3: headingStyles(theme.typography.h3),
    h4: headingStyles(theme.typography.h4),
    'h1 strong, h1 b': { fontWeight: headingBoldWeight(theme.typography.h1, theme.typography) },
    'h2 strong, h2 b': { fontWeight: headingBoldWeight(theme.typography.h2, theme.typography) },
    'h3 strong, h3 b': { fontWeight: headingBoldWeight(theme.typography.h3, theme.typography) },
    'h4 strong, h4 b': { fontWeight: headingBoldWeight(theme.typography.h4, theme.typography) },
    'h5 strong, h5 b': { fontWeight: headingBoldWeight(theme.typography.h5, theme.typography) },
    'h6 strong, h6 b': { fontWeight: headingBoldWeight(theme.typography.h6, theme.typography) },
    p: { marginBottom: theme.spacing(1) },
    blockquote: {
      margin: theme.spacing(1, 0),
      padding: theme.spacing(0.5, 2),
      borderLeft: `3px solid ${theme.colors.border.strong}`,
      color: theme.colors.text.secondary,
    },
    code: {
      background: theme.colors.background.secondary,
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    },
    '& :not(pre) > code': {
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
    },
    pre: {
      background: theme.colors.background.secondary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      overflow: 'auto',
      code: { background: 'none', padding: 0 },
    },
    hr: {
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(2, 0),
    },
  }),
});
