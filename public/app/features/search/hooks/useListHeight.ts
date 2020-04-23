import { useEffect, useState } from 'react';

/**
 * Dynamically calculate height of ref element relative to the visible part of the screen.
 * The height is updated on resize.
 * @param offsetTop
 * @param offsetBottom - used for adding bottom padding or showing extra elements
 * after the list
 */
export const useListHeight = (offsetTop = 0, offsetBottom = 150) => {
  function getHeight() {
    return window.innerHeight - offsetTop - offsetBottom;
  }

  const [height, setHeight] = useState(getHeight);

  function handleResize() {
    setHeight(getHeight());
  }
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    handleResize();
  }, [offsetTop]);

  return height;
};
