import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

type INDENT_LEVELS = 'root' | 'child';

export interface ContentOutlineItemBaseProps {
  panelId: string;
  title: string;
  icon: string;
  customTopOffset?: number;
  level?: INDENT_LEVELS;
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
    });

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [panelId, title, icon, customTopOffset, level, register, unregister]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
