import { Action } from 'kbar';

type NotNullable<T> = Exclude<T, null | undefined>;

// Create our own action type to make priority mandatory.
// Parent actions require a section, but not child actions
export type CommandPaletteAction = RootCommandPaletteAction | ChildCommandPaletteAction;

type RootCommandPaletteAction = Omit<Action, 'parent'> & {
  section: NotNullable<Action['section']>;
  priority: NotNullable<Action['priority']>;
  target?: React.HTMLAttributeAnchorTarget;
  url?: string;
};

type ChildCommandPaletteAction = Action & {
  parent: NotNullable<Action['parent']>;
  priority: NotNullable<Action['priority']>;
  target?: React.HTMLAttributeAnchorTarget;
  url?: string;
};
