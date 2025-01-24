import { useLayoutEffect, useRef, useState } from 'react';

import { measureText } from '../../utils';

export function useMultiInputAutoSize(inputValue: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputWidth, setInputWidth] = useState<string>('');

  useLayoutEffect(() => {
    if (!inputRef.current || inputValue == null) {
      setInputWidth('');
      return;
    }

    const fontSize = window.getComputedStyle(inputRef.current).fontSize;
    const textWidth = measureText(inputRef.current.value || '', parseInt(fontSize, 10)).width;
    const measureInputWidth = inputRef.current.getBoundingClientRect().width || 0;

    if (textWidth >= measureInputWidth) {
      setInputWidth(`${textWidth}px`);
    } else if (textWidth < measureInputWidth) {
      // Let input fill all space before resizing
      setInputWidth('');
    }
  }, [inputValue]);

  return { inputRef, inputWidth };
}
