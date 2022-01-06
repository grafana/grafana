import { useLayoutEffect, useRef, useEffect } from 'react';

interface Props {
  isAscending: boolean;
  messages: string[];
}

const usePanelScroll = ({ isAscending, messages }: Props) => {
  const prevScrollPosition = useRef<number>(0);

  useEffect(() => {
    const scrollbar = document.querySelector('.scrollbar-view');
    scrollbar?.addEventListener('scroll', (e: any) => {
      prevScrollPosition.current = e.target.scrollTop;
    });

    return () => {
      scrollbar?.removeEventListener('scroll', () => {
        prevScrollPosition.current = 0;
      });
    };
  }, []);

  useLayoutEffect(() => {
    const scrollbar = document.querySelector('.scrollbar-view');
    // the height of each log
    const logRowHeight = document.querySelector('tbody')?.children[0].clientHeight;
    // the height of all of the logs
    const logHeight = scrollbar?.clientHeight;
    // the new height the log panel is going to have once the new log is added
    const newLogHeight = logRowHeight && logHeight ? logRowHeight + logHeight : 0;

    if (isAscending && scrollbar) {
      if (newLogHeight < scrollbar.scrollHeight) {
        // if the scrollbar is present, we check if the user is scrolled at the bottom.
        // if he is, then we automatically scroll once a new log comes in, otherwise
        // we keep the scroll position
        if (scrollbar.scrollHeight - prevScrollPosition.current === newLogHeight) {
          scrollbar.scrollTo(0, scrollbar.scrollHeight);
        }
      }
    }
  }, [isAscending, messages]);
};

export default usePanelScroll;
