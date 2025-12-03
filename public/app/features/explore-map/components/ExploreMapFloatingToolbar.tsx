import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { useAssistant, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import pyroscopeIconSvg from 'app/plugins/datasource/grafana-pyroscope-datasource/img/grafana_pyroscope_icon.svg';
import lokiIconSvg from 'app/plugins/datasource/loki/img/loki_icon.svg';
import prometheusLogoSvg from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';
import tempoLogoSvg from 'app/plugins/datasource/tempo/img/tempo_logo.svg';
import { useDispatch, useSelector } from 'app/types/store';

import { addPanel, addFrame } from '../state/crdtSlice';
import { selectPanels, selectMapUid, selectViewport, selectSelectedPanelIds } from '../state/selectors';
import { AddPanelAction } from './AssistantComponents';

export function ExploreMapFloatingToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const currentUsername = contextSrv.user.name || contextSrv.user.login || 'Unknown';

  // Get assistant functionality
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();

  // Get canvas state for assistant context
  const panels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const mapUid = useSelector((state) => selectMapUid(state.exploreMapCRDT));
  const viewport = useSelector((state) => selectViewport(state.exploreMapCRDT));
  const selectedPanelIds = useSelector((state) => selectSelectedPanelIds(state.exploreMapCRDT));

  const handleAddPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddTracesDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'traces-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddMetricsDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'metrics-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddProfilesDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'profiles-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddLogsDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'logs-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddFrame = useCallback(() => {
    // Get selected panels that are not already in a frame
    const selectedUnframedPanels = selectedPanelIds
      .map((id) => panels[id])
      .filter((panel) => panel && !panel.frameId);

    let position: { x: number; y: number; width: number; height: number };

    if (selectedUnframedPanels.length > 0) {
      // Calculate bounds around selected unframed panels
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const panel of selectedUnframedPanels) {
        minX = Math.min(minX, panel.position.x);
        minY = Math.min(minY, panel.position.y);
        maxX = Math.max(maxX, panel.position.x + panel.position.width);
        maxY = Math.max(maxY, panel.position.y + panel.position.height);
      }

      // Add padding around the panels
      const padding = 50;
      position = {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      };
    } else {
      // No selected panels, position at viewport center
      const viewportSize = { width: window.innerWidth, height: window.innerHeight };
      const canvasCenterX = (-viewport.panX + viewportSize.width / 2) / viewport.zoom;
      const canvasCenterY = (-viewport.panY + viewportSize.height / 2) / viewport.zoom;

      const frameWidth = 800;
      const frameHeight = 600;

      position = {
        x: canvasCenterX - frameWidth / 2,
        y: canvasCenterY - frameHeight / 2,
        width: frameWidth,
        height: frameHeight,
      };
    }

    dispatch(
      addFrame({
        position,
        createdBy: currentUsername,
      })
    );
  }, [dispatch, currentUsername, selectedPanelIds, panels, viewport]);

  // Build context for assistant
  const canvasContext = useMemo(() => {
    const panelsArray = Object.values(panels);

    return createAssistantContextItem('structured', {
      title: t('explore-map.assistant.canvas-title', 'Explore Canvas'),
      data: {
        canvasId: mapUid,
        panelCount: panelsArray.length,
        panels: panelsArray.map((panel) => ({
          id: panel.id,
          mode: panel.mode,
          position: panel.position,
          datasourceUid: panel.exploreState?.datasourceUid,
          queries: panel.exploreState?.queries,
          queryCount: panel.exploreState?.queries?.length || 0,
          timeRange: panel.exploreState?.range,
          createdBy: panel.createdBy,
        })),
      },
    });
  }, [panels, mapUid]);

  // Provide component context and additional instructions to the assistant
  const componentContext = useMemo(() => {
    return createAssistantContextItem('component', {
      components: {
        AddPanelAction,
      },
      namespace: 'exploreMap',
      hidden: false, // Make visible so we can debug
      prompt: `IMPORTANT: You have an interactive component that can add pre-configured panels.

Component: exploreMap_AddPanelAction

Whitelisted props (ONLY these are allowed):
- type: MUST ALWAYS BE "explore" (only explore panels supported)
- namespace: datasource UID (optional - use to specify which datasource)
- metric: query expression (optional - PromQL, LogQL, TraceQL, etc.) - MUST BE URL-ENCODED
- description: custom button text (optional)
- name: display name (optional)

Usage (place directly in response, NEVER in code blocks):
<exploreMap_AddPanelAction type="explore" />
<exploreMap_AddPanelAction type="explore" namespace="prometheus-uid" metric="up" />
<exploreMap_AddPanelAction type="explore" namespace="loki-uid" metric="%7Bjob%3D%22varlogs%22%7D" />
<exploreMap_AddPanelAction type="explore" namespace="prometheus-uid" metric="rate%28http_requests_total%5B5m%5D%29" description="HTTP Request Rate" />

CRITICAL:
- **ALWAYS use type="explore"** - no other types are supported.
- Never wrap components in backticks or code blocks.
- Always URL-encode the metric prop to handle special characters like ( ) [ ] { } " ' etc.`,
    });
  }, []);

  // Provide additional instructions to the assistant (hidden from UI)
  const assistantInstructions = useMemo(() => {
    return createAssistantContextItem('structured', {
      hidden: true,
      title: t('explore-map.assistant.capabilities-title', 'Explore Map Capabilities'),
      data: {
        capabilities: [
          t('explore-map.assistant.capability-add-panels', 'You can help users add new panels to the canvas using the exploreMap_AddPanelAction component'),
          t('explore-map.assistant.capability-analyze', 'Analyze the current panels and suggest additional panels that would complement the existing ones'),
          t('explore-map.assistant.capability-gaps', 'Identify gaps in observability coverage (missing logs, traces, metrics, or profiles)'),
          t('explore-map.assistant.capability-layouts', 'Suggest panel layouts or organization strategies'),
          t('explore-map.assistant.capability-relationships', 'Help users understand relationships between panels based on their queries and datasources'),
        ],
        instructions: t(
          'explore-map.assistant.instructions',
          'When users ask to add panels, use the exploreMap_AddPanelAction component to provide interactive buttons. You can suggest multiple panels at once by providing multiple component instances. Always explain why you are suggesting specific panel types based on the current canvas state.'
        ),
      },
    });
  }, []);

  const handleOpenAssistant = useCallback(() => {
    if (!openAssistant) {
      return;
    }

    reportInteraction('grafana_explore_map_assistant_opened', {
      panelCount: Object.keys(panels).length,
      canvasId: mapUid,
    });

    openAssistant({
      origin: 'grafana/explore-map',
      mode: 'assistant',
      prompt:
        'Analyze this explore canvas and summarize what queries and data are being visualized. ' +
        'Identify any patterns or relationships between the panels. ' +
        'If you notice gaps in observability coverage, suggest additional panels I could add using the interactive component.',
      context: [canvasContext, componentContext, assistantInstructions],
      autoSend: true,
    });
  }, [openAssistant, panels, mapUid, canvasContext, componentContext, assistantInstructions]);

  const MenuActions = () => (
    <Menu>
      <MenuItem
        label={t('explore-map.toolbar.add-panel', 'Add Explore panel')}
        icon="compass"
        onClick={handleAddPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-metrics-drilldown-panel', 'Add Metrics Drilldown panel')}
        logoSrc={prometheusLogoSvg}
        logoAlt="Prometheus"
        onClick={handleAddMetricsDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-logs-drilldown-panel', 'Add Logs Drilldown panel')}
        logoSrc={lokiIconSvg}
        logoAlt="Loki"
        onClick={handleAddLogsDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-traces-drilldown-panel', 'Add Traces Drilldown panel')}
        logoSrc={tempoLogoSvg}
        logoAlt="Tempo"
        onClick={handleAddTracesDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-profiles-drilldown-panel', 'Add Profiles Drilldown panel')}
        logoSrc={pyroscopeIconSvg}
        logoAlt="Pyroscope"
        onClick={handleAddProfilesDrilldownPanel}
      />
    </Menu>
  );

  return (
    <div className={styles.floatingToolbar}>
      <ButtonGroup>
        <Button icon="plus" onClick={handleAddPanel} variant="primary">
          <Trans i18nKey="explore-map.toolbar.add-panel">Add panel</Trans>
        </Button>
        <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
          <Button
            aria-label={t('explore-map.toolbar.add-panel-dropdown', 'Add panel options')}
            variant="primary"
            icon={isOpen ? 'angle-up' : 'angle-down'}
          />
        </Dropdown>
      </ButtonGroup>
      <Button icon="folder-plus" onClick={handleAddFrame} variant="secondary">
        <Trans i18nKey="explore-map.toolbar.add-frame">Add frame</Trans>
      </Button>
      {isAssistantAvailable && Object.keys(panels).length > 0 && (
        <Button icon="ai-sparkle" onClick={handleOpenAssistant} variant="secondary">
          <Trans i18nKey="explore-map.toolbar.ask-assistant">Ask Assistant</Trans>
        </Button>
      )}
    </div>
  );
}

interface MenuItemWithLogoProps {
  label: string;
  logoSrc: string;
  logoAlt: string;
  onClick: () => void;
}

function MenuItemWithLogo({ label, logoSrc, logoAlt, onClick }: MenuItemWithLogoProps) {
  const styles = useStyles2(getMenuItemStyles);
  return (
    <div className={styles.menuItemWrapper}>
      <img src={logoSrc} alt={logoAlt} className={styles.logo} aria-hidden="true" />
      <MenuItem label={label} onClick={onClick} className={styles.menuItemWithLogo} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    floatingToolbar: css({
      position: 'fixed',
      bottom: theme.spacing(3),
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      zIndex: 1000,
    }),
  };
};

const getMenuItemStyles = (theme: GrafanaTheme2) => {
  return {
    menuItemWrapper: css({
      position: 'relative',
    }),
    logo: css({
      position: 'absolute',
      left: theme.spacing(1.5),
      top: '50%',
      transform: 'translateY(-50%)',
      width: '16px',
      height: '16px',
      flexShrink: 0,
      zIndex: 1,
      pointerEvents: 'none',
    }),
    menuItemWithLogo: css({
      paddingLeft: theme.spacing(4.5), // Make room for the logo
    }),
  };
};
