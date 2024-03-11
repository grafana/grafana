import { throttle } from 'lodash';
import { useState, useEffect } from 'react';

interface MousePosition {
  x: number | null;
  y: number | null;
}

// For performance reasons, we throttle the mouse position updates
const DEFAULT_THROTTLE_INTERVAL_MS = 50;

const useMousePosition = (throttleInterval = DEFAULT_THROTTLE_INTERVAL_MS) => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: null, y: null });

  useEffect(() => {
    const updateMousePosition = throttle((event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }, throttleInterval);
    window.addEventListener('mousemove', updateMousePosition);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, [throttleInterval]);

  return mousePosition;
};

export default useMousePosition;
