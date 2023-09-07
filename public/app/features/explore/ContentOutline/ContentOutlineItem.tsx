import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

export interface ContentOutlineItemBaseProps {
  title: string;
  icon: string;
  // used to sort the outline items
  // TODO - make it optional
  displayOrderId: number;
}

interface ContentOutlineItemProps extends ContentOutlineItemBaseProps {
  children: ReactNode;
  className?: string;
}

function ContentOutlineItem({ title, icon, children, className, displayOrderId }: ContentOutlineItemProps) {
  const { register, unregister } = useContentOutlineContext();
  const ref = useRef(null);

  useEffect(() => {
    // When the component mounts, register it and get its unique ID.
    const id = register({ title: title, icon: icon, ref: ref.current, displayOrderId: displayOrderId });

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [title, icon, displayOrderId, register, unregister]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

export default ContentOutlineItem;
