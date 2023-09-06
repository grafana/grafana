import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

function ContentOutlineItem({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  const { register, unregister } = useContentOutlineContext();
  const ref = useRef(null);

  useEffect(() => {
    // When the component mounts, register it and get its unique ID.
    const id = register(title, icon, ref.current);

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [title, icon]);

  return <div ref={ref}>{children}</div>;
}

export default ContentOutlineItem;
