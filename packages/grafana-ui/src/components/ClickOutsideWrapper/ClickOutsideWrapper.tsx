import { useCallback, useEffect, useRef } from 'react';
import * as React from 'react';

export interface Props {
  /** Callback to trigger when clicking outside of current element occurs. */
  onClick: () => void;
  /** Runs the 'onClick' function when pressing a key outside of the current element. Defaults to true. */
  includeButtonPress?: boolean;
  /** Object to attach the click event listener to. */
  parent?: Window | Document;
  /** https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener. Defaults to false. */
  useCapture?: boolean;
  children: React.ReactNode;
}

export function ClickOutsideWrapper({
  includeButtonPress = true,
  parent = window,
  useCapture = false,
  onClick,
  children,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onOutsideClick = useCallback(
    (event: Event) => {
      const domNode = wrapperRef.current;

      if (!domNode || (event.target instanceof Node && !domNode.contains(event.target))) {
        onClick();
      }
    },
    [onClick]
  );

  useEffect(() => {
    parent.addEventListener('click', onOutsideClick, useCapture);
    if (includeButtonPress) {
      // Use keyup since keydown already has an event listener on window
      parent.addEventListener('keyup', onOutsideClick, useCapture);
    }

    return () => {
      parent.removeEventListener('click', onOutsideClick, useCapture);
      if (includeButtonPress) {
        parent.removeEventListener('keyup', onOutsideClick, useCapture);
      }
    };
  }, [includeButtonPress, onOutsideClick, parent, useCapture]);

  return <div ref={wrapperRef}>{children}</div>;
}
