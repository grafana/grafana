import { css } from '@emotion/css';
import { createContext, type PropsWithChildren, useContext, useRef } from 'react';
import ReactDOM from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

// Tracks whether we're in a nested Portal.
// A nested portal will render inside it's parent portal instead of the default portal container.
// This prevents nested portals from being rendered in reverse order due to React's bottom-up commit phase.
const PortalContext = createContext<HTMLDivElement | null>(null);

interface Props {
  className?: string;
  root?: HTMLElement;
  // the zIndex of the node; defaults to theme.zIndex.portal
  zIndex?: number;
}

export function Portal(props: PropsWithChildren<Props>) {
  const { children, className, root, zIndex } = props;
  const theme = useTheme2();
  const parentPortal = useContext(PortalContext);
  const portalRef = useRef<HTMLDivElement | null>(null);

  const portalRoot = root ?? parentPortal ?? getPortalContainer();

  return ReactDOM.createPortal(
    <PortalContext.Provider value={portalRef.current}>
      <div
        className={className}
        ref={portalRef}
        style={{ position: 'relative', zIndex: zIndex ?? theme.zIndex.portal }}
      >
        {children}
      </div>
    </PortalContext.Provider>,
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
