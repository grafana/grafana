import { useEffect, useState, MutableRefObject } from 'react';

/**
 * Dynamically calculate height of ref element relative to the visible part of the screen.
 * The height is updated on resize.
 * @param ref
 * @param offsetBottom - used for adding bottom padding or showing extra elements
 * after the list
 */
export const useListHeight = (ref: MutableRefObject<HTMLDivElement | null>, offsetBottom = 150) => {
  function getHeight() {
    const offsetTop = ref.current?.offsetTop;
    if (!offsetTop) {
      return 0;
    }
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
  }, [ref.current]);

  return height;
};
