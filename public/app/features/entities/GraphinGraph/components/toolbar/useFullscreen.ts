import { useEffect, useState } from 'react';

interface FunUseFullscreen {
  (el?: HTMLElement): [boolean, () => void];
}

const useFullscreen: FunUseFullscreen = (el) => {
  const [fullscreen, setFullscreen] = useState(false);
  const handleFullScreenChange = () => {
    // if exit fullscreen
    if (!document.fullscreenElement) {
      setFullscreen(false);
    }
  };
  const enterFullscreen = () => {
    if (el && el.requestFullscreen) {
      el.requestFullscreen()
        .then(() => {
          setFullscreen(true);
        })
        .catch((err) => {
          console.error('requestFullscreen error: ', err);
        });
    }
  };
  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => {
          setFullscreen(false);
        })
        .catch((err) => {
          console.error('exitFullscreen error: ', err);
        });
    }
  };

  const toggleFullscreen = () => {
    if (!el) {
      console.error('need dom');
      return;
    }
    if (!fullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullScreenChange, false);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  return [fullscreen, toggleFullscreen];
};

export default useFullscreen;
