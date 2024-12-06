import { Action } from 'kbar';

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
};

type ChildCommandPaletteAction = Action & {
  parent: NotNullable<Action['parent']>;
  priority: NotNullable<Action['priority']>;
  target?: React.HTMLAttributeAnchorTarget;
  url?: string | URLCallback;
};

export type CommandPaletteActiveTab = 'recent' | 'mine' | 'all';

export const COMMAND_PALETTE_TABS: Array<{ label: string; key: CommandPaletteActiveTab }> = [
  { label: 'Recent', key: 'recent' },
  { label: 'Mine', key: 'mine' },
  { label: 'All', key: 'all' },
];
