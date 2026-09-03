import { useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import { Tooltip } from '../Tooltip/Tooltip';

interface TruncatedTextProps {
  childElement: (ref: React.ForwardedRef<HTMLElement> | undefined) => React.ReactElement;
  children: NonNullable<React.ReactNode>;
}

export const TruncatedText = React.forwardRef<HTMLElement, TruncatedTextProps>(({ childElement, children }, ref) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const internalRef = useRef<HTMLElement>(null);

  // Wire up the forwarded ref to the internal ref
  useImperativeHandle<HTMLElement | null, HTMLElement | null>(ref, () => internalRef.current);

  const resizeObserver = useMemo(
    () =>
      new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target.clientWidth && entry.target.scrollWidth) {
            setIsOverflowing(entry.target.scrollWidth > entry.target.clientWidth);
          }
        }
      }),
    []
  );

  useEffect(() => {
    const { current } = internalRef;
    if (current) {
      resizeObserver.observe(current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [setIsOverflowing, resizeObserver]);

  const [textContent, setTextContent] = useState('');
  // we intentionally want to update the state on every render to ensure the
  //  tooltip content is always up to date with the text content of the children
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (internalRef.current) {
      setTextContent(internalRef.current.textContent ?? '');
    }
  });

  if (isOverflowing) {
    return (
      <Tooltip ref={internalRef} content={textContent}>
        {childElement(undefined)}
      </Tooltip>
    );
  } else {
    return childElement(internalRef);
  }
});

TruncatedText.displayName = 'TruncatedText';
