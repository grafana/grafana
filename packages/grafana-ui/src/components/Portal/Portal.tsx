import React, { PropsWithChildren, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '../../themes';

interface Props {
  className?: string;
  root?: HTMLElement;
  forwardedRef?: any;
}

export function Portal(props: PropsWithChildren<Props>) {
  const { children, className, root: portalRoot = document.body, forwardedRef } = props;
  const theme = useTheme2();
  const node = useRef<HTMLDivElement | null>(null);
  if (!node.current) {
    node.current = document.createElement('div');
    if (className) {
      node.current.className = className;
    }
    node.current.style.position = 'relative';
    node.current.style.zIndex = `${theme.zIndex.portal}`;
  }

  useLayoutEffect(() => {
    if (node.current) {
      portalRoot.appendChild(node.current);
    }
    return () => {
      if (node.current) {
        portalRoot.removeChild(node.current);
      }
    };
  }, [portalRoot]);

  return ReactDOM.createPortal(<div ref={forwardedRef}>{children}</div>, node.current);
}

export const RefForwardingPortal = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <Portal {...props} forwardedRef={ref} />;
});
RefForwardingPortal.displayName = 'RefForwardingPortal';
