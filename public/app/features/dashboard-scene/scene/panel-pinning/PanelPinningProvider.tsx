import { css } from '@emotion/css';
import {
  createContext,
  useCallback,
  useEffect,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../DashboardScene';

import { PanelPinning, registerPanelPinning } from './PanelPinning';

const PinningContext = createContext<PanelPinning | undefined>(undefined);

export function PanelPinningProvider({
  dashboard,
  enabled,
  available = true,
  children,
}: {
  dashboard: DashboardScene;
  enabled: boolean;
  available?: boolean;
  children: ReactNode;
}) {
  const [pinning] = useState(() => new PanelPinning());
  useLayoutEffect(() => {
    if (available) {
      return registerPanelPinning(dashboard, pinning);
    }
    return;
  }, [available, dashboard, pinning]);
  useLayoutEffect(() => pinning.setEnabled(enabled), [pinning, enabled]);
  return <PinningContext.Provider value={available ? pinning : undefined}>{children}</PinningContext.Provider>;
}

export function PinnedPanelDock() {
  const pinning = useContext(PinningContext);
  return pinning ? <PanelDock pinning={pinning} /> : null;
}

function PanelDock({ pinning }: { pinning: PanelPinning }) {
  const pinned = useSyncExternalStore(pinning.subscribe, pinning.getSnapshot);
  const styles = useStyles2(getStyles);
  const onUnpin = () => {
    const origin = pinned ? pinning.getOrigin(pinned.panel) : undefined;
    pinning.unpin();
    requestAnimationFrame(() => origin?.focus());
  };

  return (
    <section
      aria-label={t('dashboard-scene.panel-pinning.region', 'Pinned panel')}
      className={styles.dock}
      hidden={!pinned}
      style={pinned ? { height: `min(${pinned.height + 40}px, 40dvh)` } : undefined}
    >
      <div className={styles.heading}>
        <Icon name="gf-pin-filled" />
        <span>{t('dashboard-scene.panel-pinning.indicator', 'Pinned to top')}</span>
        <IconButton name="times" tooltip={t('dashboard-scene.panel-pinning.unpin', 'Unpin panel')} onClick={onUnpin} />
      </div>
      <div ref={(element) => pinning.setDock(element)} className={styles.dockContent} />
    </section>
  );
}

export function PinnablePanel({ panel, children }: { panel: VizPanel; children: ReactNode }) {
  const pinning = useContext(PinningContext);
  if (!pinning) {
    return children;
  }
  return (
    <PanelHost panel={panel} pinning={pinning}>
      {children}
    </PanelHost>
  );
}

function PanelHost({ panel, pinning, children }: { panel: VizPanel; pinning: PanelPinning; children: ReactNode }) {
  const origin = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const attachOrigin = useCallback(
    (element: HTMLDivElement | null) => {
      origin.current = element;
      if (element && !hostRef.current) {
        const container = document.createElement('div');
        container.className = styles.host;
        element.appendChild(container);
        hostRef.current = container;
        // Mount descendants only after the portal container is connected and measurable.
        setHost(container);
      }
    },
    [styles.host]
  );
  const pinned = useSyncExternalStore(pinning.subscribe, pinning.getSnapshot);
  const isPinned = pinned?.panel === panel;

  useLayoutEffect(() => {
    if (origin.current) {
      return pinning.register(panel, origin.current);
    }
    return;
  }, [panel, pinning]);

  useLayoutEffect(() => {
    if (!host) {
      return;
    }
    const target = isPinned ? pinning.getDock() : origin.current;
    const focused = host.contains(document.activeElement) ? document.activeElement : null;
    if (target && host.parentElement !== target) {
      target.appendChild(host);
    }
    // Keep the same portal container so panel inputs, subscriptions, and query runners survive pin/unpin.
    if (focused instanceof HTMLElement) {
      focused.focus({ preventScroll: true });
    }
  }, [host, isPinned, pinning]);

  useEffect(() => {
    const element = origin.current;
    return () => {
      // Strict Mode replays effects while the origin stays mounted; keep the host attached then.
      if (!element?.isConnected) {
        host?.remove();
      }
    };
  }, [host]);

  return (
    <>
      <div
        ref={attachOrigin}
        tabIndex={-1}
        className={styles.origin}
        style={isPinned ? { aspectRatio: pinned.aspectRatio } : undefined}
      >
        {isPinned && (
          <div className={styles.placeholder}>
            <Icon name="gf-pin-filled" />
            <span>{t('dashboard-scene.panel-pinning.placeholder', 'This panel is pinned above the dashboard.')}</span>
          </div>
        )}
      </div>
      {host && createPortal(children, host)}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  origin: css({ width: '100%', height: '100%', minHeight: 0 }),
  host: css({ width: '100%', height: '100%', minHeight: 0 }),
  dock: css({
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1, 2),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    '&[hidden]': { display: 'none' },
  }),
  heading: css({
    minHeight: 40,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    '> span': { flex: 1 },
  }),
  dockContent: css({ flex: 1, minHeight: 0, overflow: 'auto' }),
  placeholder: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
    border: `1px dashed ${theme.colors.border.medium}`,
  }),
});
