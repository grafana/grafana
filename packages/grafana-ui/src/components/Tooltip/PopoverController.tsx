import { Placement } from '@popperjs/core';
import { useState, useRef, useCallback, type JSX } from 'react';

import { PopoverContent } from './types';

type PopperControllerRenderProp = (
  showPopper: () => void,
  hidePopper: () => void,
  popperProps: {
    show: boolean;
    placement: Placement;
    content: PopoverContent;
  }
) => JSX.Element;

interface Props {
  placement?: Placement;
  content: PopoverContent;
  className?: string;
  children: PopperControllerRenderProp;
  hideAfter?: number;
}

const PopoverController = ({ placement = 'auto', content, children, hideAfter }: Props) => {
  const [show, setShow] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPopper = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setShow(true);
  }, []);

  const hidePopper = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setShow(false);
    }, hideAfter);
  }, [hideAfter]);

  return children(showPopper, hidePopper, {
    show,
    placement,
    content,
  });
};

export { PopoverController };
