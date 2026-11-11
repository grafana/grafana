import { useCallback, useMemo, useRef, useState } from 'react';

import { t } from '@grafana/i18n';

interface PreviewContentState<T> {
  isOpen: boolean;
  isLoading: boolean;
  content: T;
}

// Shared open/loading/content lifecycle behind each card's Preview button. Callers supply their
// own content loader and error formatter, so whatever they load only reaches state through the
// stale-request check in show(), and is dropped again by hide().
export function usePreviewContent<T>(emptyContent: T) {
  const emptyRef = useRef(emptyContent);
  const [state, setState] = useState<PreviewContentState<T>>({
    isOpen: false,
    isLoading: false,
    content: emptyRef.current,
  });
  // Bumped on every show()/hide() so a show() whose content resolves after the modal was
  // dismissed (or after a newer show() call) can tell its result is stale and skip reopening it.
  const requestIdRef = useRef(0);

  const show = useCallback(async (loadContent: () => Promise<T>, formatError: (err: unknown) => T) => {
    const requestId = ++requestIdRef.current;
    setState({ isOpen: true, isLoading: true, content: emptyRef.current });
    let content: T;
    try {
      content = await loadContent();
    } catch (err) {
      content = formatError(err);
    }
    if (requestIdRef.current !== requestId) {
      return;
    }
    setState({ isOpen: true, isLoading: false, content });
  }, []);

  const hide = useCallback(() => {
    requestIdRef.current++;
    setState({ isOpen: false, isLoading: false, content: emptyRef.current });
  }, []);

  // Memoized so callers' own useCallback deps stay stable across renders that don't touch this
  // preview's state.
  return useMemo(() => ({ ...state, show, hide }), [state, show, hide]);
}

export function formatPreviewError(err: unknown): string {
  return t('alerting.import-to-gma.preview.error', 'Failed to load content: {{error}}', {
    error: err instanceof Error ? err.message : String(err),
  });
}
