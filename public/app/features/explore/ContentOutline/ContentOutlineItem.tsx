import { useEffect, useRef, ReactNode } from 'react';
import * as React from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

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
  onClick?: (e: React.MouseEvent) => void;
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

interface ContentOutlineItemProps extends ContentOutlineItemBaseProps {
  children: ReactNode;
  className?: string;
}

export function ContentOutlineItem({
  panelId,
  title,
  icon,
  customTopOffset,
  children,
  className,
  level = 'root',
  mergeSingleChild,
  type = 'scrollIntoView',
  onClick,
}: ContentOutlineItemProps) {
  const { register, unregister } = useContentOutlineContext() ?? {};
  const ref = useRef(null);

  useEffect(() => {
    if (!register || !unregister) {
      return;
    }

    // When the component mounts, register it and get its unique ID.
    const id = register({
      panelId: panelId,
      title: title,
      icon: icon,
      ref: ref.current,
      customTopOffset: customTopOffset,
      level: level,
      mergeSingleChild,
      type,
    });

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [panelId, title, icon, customTopOffset, level, mergeSingleChild, register, unregister, type, onClick]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
