import React, { PropsWithChildren, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { useTheme2 } from '../../themes';

interface Props {
  className?: string;
  root?: HTMLElement;
  forwardedRef?: React.ForwardedRef<HTMLDivElement>;
}

export function Portal(props: PropsWithChildren<Props>) {
  const { children, className, root, forwardedRef } = props;
  const theme = useTheme2();
  const node = useRef<HTMLDivElement | null>(null);
  const portalRoot = root ?? getPortalContainer();

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

/** @internal */
export function getPortalContainer() {
  return window.document.getElementById('grafana-portal-container') ?? document.body;
}

/** @internal */
export function PortalContainer() {
  return <div id="grafana-portal-container" />;
}

export const RefForwardingPortal = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <Portal {...props} forwardedRef={ref} />;
});

RefForwardingPortal.displayName = 'RefForwardingPortal';
