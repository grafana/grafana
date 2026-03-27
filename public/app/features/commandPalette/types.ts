import { Action } from 'kbar';

import { ManagerKind } from 'app/features/apiserver/types';

type NotNullable<T> = Exclude<T, null | undefined>;

// Create our own action type to make priority mandatory.
// Parent actions require a section, but not child actions
export type CommandPaletteAction = RootCommandPaletteAction | ChildCommandPaletteAction;

export type URLCallback = (searchQuery: string) => string;

type SharedActionFields = {
  target?: React.HTMLAttributeAnchorTarget;
  url?: string | URLCallback;
  managedBy?: ManagerKind;
};

type RootCommandPaletteAction = Omit<Action, 'parent'> & {
  section: NotNullable<Action['section']>;
  priority: NotNullable<Action['priority']>;
} & SharedActionFields;

type ChildCommandPaletteAction = Action & {
  parent: NotNullable<Action['parent']>;
  priority: NotNullable<Action['priority']>;
} & SharedActionFields;
