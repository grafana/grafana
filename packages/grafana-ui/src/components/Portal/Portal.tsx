import React, { PropsWithChildren, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '../../themes';

interface Props {
  className?: string;
  root?: HTMLElement;
  forwardedRef?: any;
}

export function Portal(props: PropsWithChildren<Props>) {
  const { children, className, root = document.body, forwardedRef } = props;
  const theme = useTheme2();
  const [node] = useState(document.createElement('div'));
  const portalRoot = root;

  if (className) {
    node.classList.add(className);
  }
  node.style.position = 'relative';
  node.style.zIndex = `${theme.zIndex.portal}`;

  useEffect(() => {
    portalRoot.appendChild(node);
    return () => {
      portalRoot.removeChild(node);
    };
  }, [node, portalRoot]);

  return ReactDOM.createPortal(<div ref={forwardedRef}>{children}</div>, node);
}

export const RefForwardingPortal = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <Portal {...props} forwardedRef={ref} />;
});
RefForwardingPortal.displayName = 'RefForwardingPortal';
