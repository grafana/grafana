import { useRef, useEffect } from 'react';

export const useRefMounted = () => {
  const refMounted = useRef(false);
  useEffect(() => {
    refMounted.current = true;
    return () => {
      refMounted.current = false;
    };
  });
  return refMounted;
};
