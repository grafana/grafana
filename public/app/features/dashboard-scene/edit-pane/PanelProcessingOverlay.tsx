import { css, keyframes } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneObject, useSceneObjectState, VizPanel } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

import { DashboardEditPane } from './DashboardEditPane';

const SETTLE_DELAY_MS = 1500;
const MAX_PROCESSING_MS = 30_000;

const PANEL_VISUAL_PROPERTIES = new Set([
  'title',
  'description',
  'pluginId',
  'pluginVersion',
  'options',
  'fieldConfig',
  'displayMode',
]);

interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

export function PanelProcessingOverlays({ editPane, dashboard }: Props) {
  const { processingPanelKeys } = useSceneObjectState(editPane);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const maxTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!processingPanelKeys?.length) {
      return;
    }

    maxTimerRef.current = setTimeout(() => {
      editPane.clearProcessingPanels();
    }, MAX_PROCESSING_MS);

    const subs: Array<{ unsubscribe: () => void }> = [];

    for (const key of processingPanelKeys) {
      try {
        const panel = sceneGraph.findByKey(dashboard, key);
        if (panel instanceof VizPanel) {
          const sub = panel.subscribeToState((newState, prevState) => {
            const changed = Object.keys(newState).some(
              (k) =>
                PANEL_VISUAL_PROPERTIES.has(k) &&
                newState[k as keyof typeof newState] !== prevState[k as keyof typeof prevState]
            );

            if (!changed) {
              return;
            }

            if (settleTimerRef.current) {
              clearTimeout(settleTimerRef.current);
            }

            settleTimerRef.current = setTimeout(() => {
              editPane.clearProcessingPanels();
            }, SETTLE_DELAY_MS);
          });
          subs.push(sub);
        }
      } catch {
        // Panel may not exist yet
      }
    }

    return () => {
      for (const sub of subs) {
        sub.unsubscribe();
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
      }
    };
  }, [processingPanelKeys, dashboard, editPane]);

  if (!processingPanelKeys?.length) {
    return null;
  }

  return (
    <>
      {processingPanelKeys.map((key) => (
        <PanelHighlight key={key} panelKey={key} dashboard={dashboard} />
      ))}
    </>
  );
}

function PanelHighlight({ panelKey, dashboard }: { panelKey: string; dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = findPanelDomElement(panelKey, dashboard);
    setContainer(el);
  }, [panelKey, dashboard]);

  if (!container) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.fill} />
      <div className={styles.badge}>
        <Icon name="ai-sparkle" size="xs" />
      </div>
    </div>,
    container
  );
}

export function findPanelDomElement(panelKey: string, dashboard: DashboardScene): HTMLElement | null {
  try {
    const panel = sceneGraph.findByKey(dashboard, panelKey);
    if (!panel) {
      return null;
    }

    let current: SceneObject | undefined = panel;
    while (current) {
      if (current instanceof DashboardGridItem && current.containerRef?.current) {
        return current.containerRef.current;
      }
      current = current.parent;
    }
  } catch {
    // Panel may no longer exist
  }

  return null;
}

const borderRotate = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const fillPulse = keyframes`
  0%, 100% { opacity: 0; }
  50% { opacity: 0.2; }
`;

const badgePulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
`;

function getStyles(theme: GrafanaTheme2) {
  const glowGradient =
    'linear-gradient(45deg, oklab(0.49 0.04 -0.3), oklab(0.65 0.27 -0.16), oklab(0.64 0.28 0.01), oklab(0.65 0.2 0.14), oklab(0.73 0.13 0.17), oklab(0.49 0.04 -0.3))';

  return {
    overlay: css({
      position: 'absolute',
      inset: -1,
      borderRadius: theme.shape.radius.default,
      border: '1px solid transparent',
      background: `transparent padding-box, ${glowGradient} border-box`,
      backgroundSize: '300% 300%',
      pointerEvents: 'none',
      zIndex: 1,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${borderRotate} 3s ease infinite`,
      },
    }),
    fill: css({
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      background: glowGradient,
      backgroundSize: '300% 300%',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${borderRotate} 3s ease infinite, ${fillPulse} 2s ease-in-out infinite`,
      },
    }),
    badge: css({
      position: 'absolute',
      top: -10,
      left: -10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background:
        'linear-gradient(135deg, oklab(0.49 0.04 -0.3), oklab(0.65 0.27 -0.16), oklab(0.73 0.13 0.17))',
      color: '#fff',
      boxShadow: 'rgba(168, 85, 247, 0.5) 0 0 8px',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${badgePulse} 2s ease-in-out infinite`,
      },
    }),
  };
}
