import { cx, css } from '@emotion/css';
import React, { useEffect, useRef, ReactNode } from 'react';

import { useContentOutlineContext } from './ContentOutlineContext';

export interface ContentOutlineItemBaseProps {
  title: string;
  icon: string;
}

interface ContentOutlineItemProps extends ContentOutlineItemBaseProps {
  children: ReactNode;
  className?: string;
}

const baseStyle = css({
  // acounts for the height of the sticky ExploreToolbar
  scrollMarginTop: '60px',
  /**
   * when the pane is narrow enough to have horizontal scroll, this prevents
   * the pane from scrolling horizontally and pushing the content outline off screen
   */
  scrollMarginLeft: '70px',
});

function ContentOutlineItem({ title, icon, children, className }: ContentOutlineItemProps) {
  const { register, unregister } = useContentOutlineContext();
  const ref = useRef(null);
  const styles = cx(baseStyle, className);

  // const styles = cx(baseStyle, className);

  useEffect(() => {
    // When the component mounts, register it and get its unique ID.
    const id = register({ title: title, icon: icon, ref: ref.current });

    // When the component unmounts, unregister it using its unique ID.
    return () => unregister(id);
  }, [title, icon, register, unregister]);

  return (
    <div className={styles} ref={ref}>
      {children}
    </div>
  );
}

export default ContentOutlineItem;
