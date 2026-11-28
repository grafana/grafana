import { type ComponentType, type ReactNode } from 'react';

import { locationService } from '@grafana/runtime';

/** What is being commented on. Mirrors `spec.target` of the comments API. */
export interface CommentsTarget {
  /** The kind of resource, e.g. `Notebook`. The comments app only accepts kinds it has registered. */
  kind: string;
  /** The resource's name (its uid). Empty while there is nothing to comment on yet, e.g. an unsaved notebook. */
  name: string;
}

export interface CommentsProviderProps {
  target: CommentsTarget;
  children: ReactNode;
}

/**
 * What a feature gets for one anchor, to build its own entry point with. The comments UI supplies the
 * behavior; the feature supplies the component and decides where it shows.
 */
export interface CommentsAnchor {
  /** How many comments, replies included, are open on the anchor. */
  count: number;
  /** Whether the anchor's comments are showing. */
  isOpen: boolean;
  /** Opens the anchor's comments, or closes them. */
  toggle: () => void;
  /**
   * Call with the element the box should float beside, as a ref callback: `ref={anchor.setElement}`.
   * (Not named `ref`: the React Compiler lint takes any object with a `ref` property for a ref.)
   */
  setElement: (element: HTMLElement | null) => void;
  /** Whether the user may add comments; without it they can only read what is there. */
  canWrite: boolean;
}

type UseCommentsAnchor = (anchorId: string) => CommentsAnchor | undefined;

interface CommentsImplementation {
  Provider: ComponentType<CommentsProviderProps>;
  useAnchor: UseCommentsAnchor;
}

let internal: CommentsImplementation | undefined;

/** Called by enterprise at boot, once comments are enabled for at least one kind. */
export function registerComments(implementation: CommentsImplementation) {
  internal = implementation;
}

/**
 * Wrap what should be commentable in this, naming the target. Renders only its children in OSS, with no
 * implementation registered, and on the PDF render route.
 */
export function CommentsProvider({ target, children }: CommentsProviderProps) {
  const Provider = internal?.Provider;
  if (!Provider || isRenderRoute()) {
    return <>{children}</>;
  }
  return <Provider target={target}>{children}</Provider>;
}

const useNoAnchor: UseCommentsAnchor = () => undefined;

/**
 * The hook a feature builds its entry point with: attach `setElement` and `toggle` to whatever element and
 * handler it likes, and put it wherever its layout wants it (a gutter, a panel header, a line of text).
 * Returns undefined, so the feature renders nothing, in OSS, outside a `CommentsProvider`, on the PDF
 * render route, and when comments are off for the kind.
 */
export function useCommentsAnchor(anchorId: string): CommentsAnchor | undefined {
  // Fixed at boot, so every render calls the same hook.
  const useAnchor = internal?.useAnchor ?? useNoAnchor;
  return useAnchor(anchorId);
}

// The PDF render route (see notebookRenderUrl) reads the notebook for a screenshot and takes no part in
// comments, so it should not even ask for them.
function isRenderRoute(): boolean {
  return locationService.getLocation().pathname.endsWith('/render');
}
