import { type Action, type ActionImpl } from 'kbar';

import { type ManagerKind } from 'app/features/apiserver/types';

type NotNullable<T> = Exclude<T, null | undefined>;

// Create our own action type to make priority mandatory.
// Parent actions require a section, but not child actions
export type CommandPaletteAction = RootCommandPaletteAction | ChildCommandPaletteAction;

export type URLCallback = (searchQuery: string) => string;

type RootCommandPaletteAction = Omit<Action, 'parent'> & {
  section: NotNullable<Action['section']>;
  priority: NotNullable<Action['priority']>;
  target?: React.HTMLAttributeAnchorTarget;
  url?: string | URLCallback;
  managedBy?: ManagerKind;
  /** Stable, language-agnostic section id for analytics (see SECTION_* in values.ts). */
  sectionId?: string;
};

type ChildCommandPaletteAction = Action & {
  parent: NotNullable<Action['parent']>;
  priority: NotNullable<Action['priority']>;
  target?: React.HTMLAttributeAnchorTarget;
  url?: string | URLCallback;
  /** Stable, language-agnostic section id for analytics (see SECTION_* in values.ts). */
  sectionId?: string;
};

/**
 * Reads the custom `sectionId` off a kbar ActionImpl. kbar copies custom action
 * properties onto ActionImpl at runtime but doesn't surface them on its type, so
 * we narrow with `in` + a typeof check rather than asserting.
 */
export function getActionSectionId(action: ActionImpl): string | undefined {
  if ('sectionId' in action && typeof action.sectionId === 'string') {
    return action.sectionId;
  }
  return undefined;
}
