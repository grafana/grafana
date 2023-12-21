import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

export interface ContentOutlineItemBaseProps {
  panelId: string;
  title: string;
  icon: string;
}

interface ContentOutlineItemProps extends ContentOutlineItemBaseProps {
  children: ReactNode;
  className?: string;
}

export function ContentOutlineItem({ panelId, title, icon, children, className }: ContentOutlineItemProps) {
  const { register, unregister } = useContentOutlineContext();
  const ref = useRef(null);

  useEffect(() => {
    // When the component mounts, register it and get its unique ID.
    const id = register({ panelId: panelId, title: title, icon: icon, ref: ref.current });

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [panelId, title, icon, register, unregister]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
