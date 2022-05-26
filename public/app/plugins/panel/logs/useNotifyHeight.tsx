import { useEffect } from 'react';

const useNotifyHeight = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.top !== window.self) {
        const scrollbar = document.querySelector('.scrollbar-view');
        const panelTitle = document.querySelector('.panel-title');
        if (scrollbar && panelTitle) {
          const height = `${scrollbar?.scrollHeight + panelTitle?.clientHeight}px`;
          window.parent.postMessage(height, '*');
        }
      }
    }, 0);

    return () => clearInterval(interval);
  }, []);
};

export default useNotifyHeight;
