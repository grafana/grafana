import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

interface ContentOutlineItemProps {
  title: string;
  icon: string;
  children: ReactNode;
  className?: string;
}

function ContentOutlineItem({ title, icon, children, className }: ContentOutlineItemProps) {
  const { register, unregister } = useContentOutlineContext();
  const ref = useRef(null);

  useEffect(() => {
    // When the component mounts, register it and get its unique ID.
    const id = register(title, icon, ref.current);

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [title, icon, register, unregister]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

export default ContentOutlineItem;
