import { useState, useEffect } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

function getWindowDimensions(): Dimensions {
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height,
  };
}

// Returns window hieght and width. Responds to resize events
// Based on https://stackoverflow.com/questions/36862334/get-viewport-window-height-in-reactjs
export default function useWindowDimensions(): Dimensions {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}
