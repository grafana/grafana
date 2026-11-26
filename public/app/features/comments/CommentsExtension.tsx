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

export interface CommentsTriggerProps {
  /** Identifies what is commented on within the target: a cell id, a panel key, ... Opaque to the API. */
  anchorId: string;
  className?: string;
  /** Tells the feature whether the box is open, so it can show which anchor the comments belong to. */
  onActiveChange?: (active: boolean) => void;
}

interface CommentsImplementation {
  Provider: ComponentType<CommentsProviderProps>;
  Trigger: ComponentType<CommentsTriggerProps>;
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

/**
 * Place this wherever the feature wants the comment button: a gutter, a panel header, a line of text. Must
 * be under a `CommentsProvider`; renders nothing otherwise, in OSS, or when comments are off for the kind.
 */
export function CommentsTrigger(props: CommentsTriggerProps) {
  const Trigger = internal?.Trigger;
  if (!Trigger || isRenderRoute()) {
    return null;
  }
  return <Trigger {...props} />;
}

// The PDF render route (see notebookRenderUrl) reads the notebook for a screenshot and takes no part in
// comments, so it should not even ask for them.
function isRenderRoute(): boolean {
  return locationService.getLocation().pathname.endsWith('/render');
}
