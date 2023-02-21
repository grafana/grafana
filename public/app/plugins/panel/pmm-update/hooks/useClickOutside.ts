import { useEffect, RefObject } from 'react';

export const useClickOutside = (ref: RefObject<HTMLElement>, handler: (e: Event) => void) => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        handler(e);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler(e);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [ref, handler]);
};
