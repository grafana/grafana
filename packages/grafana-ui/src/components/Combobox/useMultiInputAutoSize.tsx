import { useLayoutEffect, useRef, useState } from 'react';

import { measureText } from '../../utils';

export function useMultiInputAutoSize(inputValue: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialInputWidth = useRef<number>(0); // Store initial width to prevent resizing on backspace
  const [inputWidth, setInputWidth] = useState<string>('');

  useLayoutEffect(() => {
    if (inputRef.current && inputValue == null && initialInputWidth.current === 0) {
      initialInputWidth.current = inputRef?.current.getBoundingClientRect().width;
    }

    if (!inputRef.current || inputValue == null) {
      setInputWidth('');
      return;
    }

    const fontSize = window.getComputedStyle(inputRef.current).fontSize;
    const textWidth = measureText(inputRef.current.value || '', parseInt(fontSize, 10)).width;

    if (textWidth < initialInputWidth.current) {
      // Let input fill all space before resizing
      setInputWidth('');
    } else {
      // Add pixels to prevent clipping
      setInputWidth(`${textWidth + 5}px`);
    }
  }, [inputValue]);

  return { inputRef, inputWidth };
}
