import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import reactToText from 'react-to-text';

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
            if (entry.target.scrollWidth > entry.target.clientWidth) {
              setIsOverflowing(true);
            }
            if (entry.target.scrollWidth <= entry.target.clientWidth) {
              setIsOverflowing(false);
            }
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

  if (isOverflowing) {
    return (
      <Tooltip ref={internalRef} content={reactToText(children)}>
        {childElement(undefined)}
      </Tooltip>
    );
  } else {
    return childElement(internalRef);
  }
});

TruncatedText.displayName = 'TruncatedText';
