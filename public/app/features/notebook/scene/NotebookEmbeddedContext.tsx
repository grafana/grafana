import { createContext, type ReactNode, useContext } from 'react';

/**
 * Whether the notebook being rendered has a Grafana app header above it.
 *
 * A property of the tree the document is drawn in, NOT of the document — which is why it cannot live
 * on the scene. One notebook can be on screen twice, on the /notebooks route and in a host that has
 * no app header, and those two share a single scene object so they share a single autosave. Scene
 * state has no way to answer this differently for each of them: the second mount to set it would win
 * for both, and on the route that leaves the sticky controls row offset to 0 and sitting underneath
 * the header.
 *
 * Its own module, rather than living beside the embeddable component that provides it: the scene
 * renderer consumes it, and `embed/` already imports from `scene/`, so putting it there would close
 * an import cycle.
 */
const NotebookEmbeddedContext = createContext(false);

/**
 * Marks everything inside as rendered without an app header above it.
 *
 * Wrap the rendered scene, not the scene object — the point is that the answer travels with the
 * tree.
 */
export function NotebookEmbeddedHost({ children }: { children: ReactNode }) {
  return <NotebookEmbeddedContext.Provider value={true}>{children}</NotebookEmbeddedContext.Provider>;
}

/** False by default, so the /notebooks route needs no provider and is unaffected. */
export function useIsNotebookEmbedded(): boolean {
  return useContext(NotebookEmbeddedContext);
}
