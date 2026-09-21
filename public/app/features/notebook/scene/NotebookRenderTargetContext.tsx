import { createContext, type ReactNode, useContext } from 'react';

/**
 * Whether the notebook being rendered is being captured rather than read — the headless browser
 * behind "Export as PDF" (see NotebookRenderPage).
 *
 * A property of the tree the document is drawn in, NOT of the document, for the same reason
 * NotebookEmbeddedContext is: one scene object can be mounted more than once, so scene state has no
 * way to answer this differently per mount. It is also deliberately not read off the url — the route
 * already decides this, and a page that re-derives it from a query param can disagree with the route
 * that mounted it.
 *
 * Its own module, beside NotebookEmbeddedContext and for the same reason: the scene renderer
 * consumes it while `pages/` provides it, so putting it in `pages/` would close an import cycle.
 */
const NotebookRenderTargetContext = createContext(false);

/**
 * Marks everything inside as drawn for a capture rather than for a reader.
 *
 * Wrap the rendered scene, not the scene object — the point is that the answer travels with the
 * tree.
 */
export function NotebookRenderTarget({ children }: { children: ReactNode }) {
  return <NotebookRenderTargetContext.Provider value={true}>{children}</NotebookRenderTargetContext.Provider>;
}

/** False by default, so the ordinary /notebooks route needs no provider and is unaffected. */
export function useIsNotebookRenderTarget(): boolean {
  return useContext(NotebookRenderTargetContext);
}
