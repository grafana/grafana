import type { MouseEvent, ReactNode } from 'react';
import { SetOptional } from 'type-fest';

type INDENT_LEVELS = 'root' | 'child';

export type ITEM_TYPES = 'scrollIntoView' | 'filter';

export interface ContentOutlineItemBaseProps {
  panelId: string;
  title: string;
  icon: string;
  /**
   * Custom offset from the top of the Explore container when scrolling to this item.
   * Items like query row need some offset so the top of the query row is not hidden behind the header.
   */
  customTopOffset?: number;
  /**
   * The level of indentation for this item.
   * - `root` is the top level item.
   * - `child` is an item that is a child of an item with `root` level.
   */
  level?: INDENT_LEVELS;
  /**
   * Merges a single child of this item with this item.
   * e.g. It doesn't make sense to nest a single query row under a queries container
   * because user can navigate to the query row by navigating to the queries container.
   */
  mergeSingleChild?: boolean;
  // callback that is called when the item is clicked
  // need this for filtering logs
  onClick?: (e: MouseEvent) => void;
  type?: ITEM_TYPES;
  /**
   * Client can additionally mark filter actions as highlighted
   */
  highlight?: boolean;
  onRemove?: (id: string) => void;
  /**
   * Child that will always be on top of the list
   * e.g. pinned log in Logs section
   */
  childOnTop?: boolean;
  expanded?: boolean;
}
export interface ContentOutlineItemProps extends ContentOutlineItemBaseProps {
  children: ReactNode;
  className?: string;
}
export interface ContentOutlineItemContextProps extends ContentOutlineItemBaseProps {
  id: string;
  ref: HTMLElement | null;
  color?: string;
  children?: ContentOutlineItemContextProps[];
}
export type RegisterFunction = (outlineItem: SetOptional<ContentOutlineItemContextProps, 'id'>) => string;
export interface ContentOutlineContextProps {
  outlineItems: ContentOutlineItemContextProps[];
  register: RegisterFunction;
  unregister: (id: string) => void;
  unregisterAllChildren: (
    parentIdGetter: (items: ContentOutlineItemContextProps[]) => string | undefined,
    childType: ITEM_TYPES
  ) => void;
  updateOutlineItems: (newItems: ContentOutlineItemContextProps[]) => void;
  updateItem: (id: string, properties: Partial<Omit<ContentOutlineItemContextProps, 'id'>>) => void;
}
