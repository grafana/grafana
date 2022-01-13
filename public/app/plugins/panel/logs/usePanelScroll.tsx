import { useLayoutEffect, useState, useRef, useEffect } from 'react';

interface Props {
  isAscending: boolean;
  messages: string[];
}

const usePanelScroll = ({ isAscending, messages }: Props) => {
  const [scrollTop, setScrollTop] = useState(0);
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
        // if the scrollbar is present, we check if the user is scrolled at the bottom to
        // determine if we are gonna scroll all the way down when a new log comes in
        // or if we are gonna keep our scroll position
        if (scrollbar.scrollHeight - prevScrollPosition.current === newLogHeight) {
          setScrollTop(scrollbar.scrollHeight);
          scrollbar.scrollTo(0, scrollbar.scrollHeight);
        } else {
          setScrollTop(prevScrollPosition.current);
        }
      } else {
        // if the scrollbar is not present, we scroll to the bottom by default
        // so when it starts to be present, its at the bottom position by default
        // until the user scrolls up
        setScrollTop(prevScrollPosition.current || 0);
      }
    } else if (!isAscending && scrollbar) {
      if (prevScrollPosition.current === 0) {
        setScrollTop(prevScrollPosition.current);
      } else {
        setScrollTop(prevScrollPosition.current + (logRowHeight || 0));
      }
    }
  }, [isAscending, messages]);

  return {
    scrollTop,
  };
};

export default usePanelScroll;
