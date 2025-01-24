import { useLayoutEffect, useRef } from 'react';

import { measureText } from '../../utils';

export function useMultiInputAutoSize() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Add onKeyDup event listener

  useLayoutEffect(() => {
    const effectRef = inputRef.current;

    const keyDownHandler = (e: KeyboardEvent) => {
      if (!effectRef) {
        return;
      }
      const fontSize = window.getComputedStyle(effectRef).fontSize;
      const textWidth = measureText(effectRef.value || '', parseInt(fontSize, 10)).width;
      const measureInputWidth = effectRef.getBoundingClientRect().width || 0;

      if (textWidth > measureInputWidth) {
        effectRef.style.width = `${textWidth}px`;
      } else if (textWidth < measureInputWidth) {
        // Let input fill all space before resizing
        effectRef.style.width = '';
      }
    };

    effectRef?.addEventListener('keydown', keyDownHandler);

    return () => {
      effectRef?.removeEventListener('keydown', keyDownHandler);
    };
  });

  return inputRef;
}
