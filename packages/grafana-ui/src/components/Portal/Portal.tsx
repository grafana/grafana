import { css } from '@emotion/css';
import { createContext, type PropsWithChildren, useContext } from 'react';
import * as React from 'react';
import ReactDOM from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

// Tracks nesting depth so inner portals get a higher z-index than outer ones.
// React commits fibers bottom-up, so nested portals targeting the same container
// end up in reverse DOM order. Incrementing z-index by depth fixes stacking.
const PortalDepthContext = createContext(0);

interface Props {
  className?: string;
  root?: HTMLElement;
  // the zIndex of the node; defaults to theme.zIndex.portal
  zIndex?: number;
  forwardedRef?: React.ForwardedRef<HTMLDivElement>;
}

export function Portal(props: PropsWithChildren<Props>) {
  const { children, className, root, forwardedRef } = props;
  const theme = useTheme2();
  const portalRoot = root ?? getPortalContainer();
  const depth = useContext(PortalDepthContext);
  const zIndex = props.zIndex ?? theme.zIndex.portal + depth;

  return ReactDOM.createPortal(
    <PortalDepthContext.Provider value={depth + 1}>
      <div className={className} style={{ position: 'relative', zIndex }}>
        <div ref={forwardedRef}>{children}</div>
      </div>
    </PortalDepthContext.Provider>,
    portalRoot
  );
}

/** @internal */
export function getPortalContainer() {
  return window.document.getElementById('grafana-portal-container') ?? document.body;
}

/** @internal */
export function PortalContainer() {
  const styles = useStyles2(getStyles);
  return (
    <div
      id="grafana-portal-container"
      data-testid={selectors.components.Portal.container}
      className={styles.grafanaPortalContainer}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grafanaPortalContainer: css({
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: theme.zIndex.portal,
    }),
  };
};

export const RefForwardingPortal = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <Portal {...props} forwardedRef={ref} />;
});

RefForwardingPortal.displayName = 'RefForwardingPortal';
