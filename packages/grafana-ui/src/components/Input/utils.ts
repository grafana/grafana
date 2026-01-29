import { RefObject, useRef } from 'react';

export function useFocus(): [RefObject<HTMLInputElement | null>, () => void] {
  const ref = useRef<HTMLInputElement | null>(null);
  const setFocus = () => {
    ref.current && ref.current.focus();
  };
  return [ref, setFocus];
}
