import { useEffect, useRef } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';
import { ContentOutlineItemProps } from './types';

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
