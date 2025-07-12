import { locationUtil, SetPanelAttentionEvent } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { KeybindingSet } from 'app/core/services/KeybindingSet';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { shareDashboardType } from '../../dashboard/components/ShareModal/utils';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getEditPanelUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { onRemovePanel, toggleVizPanelLegend } from './PanelMenuBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

export function setupKeyboardShortcuts(scene: DashboardScene) {
  const keybindings = new KeybindingSet();
  let vizPanelKey: string | null = null;

  const canEdit = scene.canEditDashboard();

  const panelAttentionSubscription = appEvents.subscribe(SetPanelAttentionEvent, (event) => {
    if (typeof event.payload.panelId === 'string') {
      vizPanelKey = event.payload.panelId;
    }
  });

  function withFocusedPanel(scene: DashboardScene, fn: (vizPanel: VizPanel) => void) {
    return () => {
      const vizPanel = sceneGraph.findObject(scene, (o) => o.state.key === vizPanelKey);
      if (vizPanel && vizPanel instanceof VizPanel) {
        fn(vizPanel);
        return;
      }
    };
  }

  // View panel
  keybindings.addBinding({
    key: 'v',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      if (scene.state.viewPanelScene) {
        locationService.push(
          locationUtil.getUrlForPartial(locationService.getLocation(), {
            viewPanel: undefined,
          })
        );
      } else {
        const url = locationUtil.stripBaseFromUrl(getViewPanelUrl(vizPanel));
        locationService.push(url);
      }
    }),
  });

  // Panel share
  if (config.featureToggles.newDashboardSharingComponent) {
    keybindings.addBinding({
      key: 'p u',
      onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
        const drawer = new ShareDrawer({
          shareView: shareDashboardType.link,
          panelRef: vizPanel.getRef(),
        });

        scene.showModal(drawer);
      }),
    });
    keybindings.addBinding({
      key: 'p e',
      onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
        const drawer = new ShareDrawer({
          shareView: shareDashboardType.embed,
          panelRef: vizPanel.getRef(),
        });

        scene.showModal(drawer);
      }),
    });

    if (
      contextSrv.isSignedIn &&
      config.snapshotEnabled &&
      contextSrv.hasPermission(AccessControlAction.SnapshotsCreate)
    ) {
      keybindings.addBinding({
        key: 'p s',
        onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
          const drawer = new ShareDrawer({
            shareView: shareDashboardType.snapshot,
            panelRef: vizPanel.getRef(),
          });

          scene.showModal(drawer);
        }),
      });
    }
  } else {
    keybindings.addBinding({
      key: 'p s',
      onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
        scene.showModal(new ShareModal({ panelRef: vizPanel.getRef() }));
      }),
    });
  }

  // Panel inspect
  keybindings.addBinding({
    key: 'i',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      if (scene.state.inspectPanelKey) {
        locationService.push(
          locationUtil.getUrlForPartial(locationService.getLocation(), {
            inspect: undefined,
          })
        );
      } else {
        locationService.push(locationUtil.stripBaseFromUrl(getInspectUrl(vizPanel)));
      }
    }),
  });

  // Got to Explore for panel
  keybindings.addBinding({
    key: 'p x',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      const url = await tryGetExploreUrlForPanel(vizPanel);
      if (url) {
        locationService.push(url);
      }
    }),
  });

  // Toggle legend
  keybindings.addBinding({
    key: 'p l',
    onTrigger: withFocusedPanel(scene, toggleVizPanelLegend),
  });

  // Refresh
  keybindings.addBinding({
    key: 'd r',
    onTrigger: () => sceneGraph.getTimeRange(scene).onRefresh(),
  });

  // Zoom out
  keybindings.addBinding({
    key: 't z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });

  keybindings.addBinding({
    key: 'ctrl+z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });

  // Relative -> Absolute time range
  keybindings.addBinding({
    key: 't a',
    onTrigger: () => {
      const timePicker = dashboardSceneGraph.getTimePicker(scene);
      timePicker?.toAbsolute();
    },
  });

  keybindings.addBinding({
    key: 't left',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'left');
    },
  });

  keybindings.addBinding({
    key: 't right',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'right');
    },
  });

  if (canEdit) {
    // Panel edit
    keybindings.addBinding({
      key: 'e',
      onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
        const sceneRoot = vizPanel.getRoot();
        if (sceneRoot instanceof DashboardScene) {
          const panelId = getPanelIdForVizPanel(vizPanel);
          if (scene.state.editPanel) {
            locationService.push(
              locationUtil.getUrlForPartial(locationService.getLocation(), {
                editPanel: undefined,
              })
            );
          } else {
            const url = locationUtil.stripBaseFromUrl(getEditPanelUrl(panelId));
            locationService.push(url);
          }
        }
      }),
    });

    // Dashboard settings
    keybindings.addBinding({
      key: 'd s',
      onTrigger: scene.onOpenSettings,
    });

    // Open save drawer
    keybindings.addBinding({
      key: 'mod+s',
      onTrigger: () => scene.openSaveDrawer({}),
    });

    // delete panel
    keybindings.addBinding({
      key: 'p r',
      onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
        if (scene.state.isEditing) {
          onRemovePanel(scene, vizPanel);
        }
      }),
    });

    // duplicate panel
    keybindings.addBinding({
      key: 'p d',
      onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
        if (scene.state.isEditing) {
          scene.duplicatePanel(vizPanel);
        }
      }),
    });

    // collapse all rows
    keybindings.addBinding({
      key: 'd shift+c',
      onTrigger: () => {
        if (scene.state.body instanceof DefaultGridLayoutManager) {
          scene.state.body.collapseAllRows();
        }
      },
    });

    // expand all rows
    keybindings.addBinding({
      key: 'd shift+e',
      onTrigger: () => {
        if (scene.state.body instanceof DefaultGridLayoutManager) {
          scene.state.body.expandAllRows();
        }
      },
    });
  }

  // toggle all panel legends (TODO)
  // toggle all exemplars (TODO)

  return () => {
    keybindings.removeAll();
    panelAttentionSubscription.unsubscribe();
  };
}

function handleZoomOut(scene: DashboardScene) {
  const timePicker = dashboardSceneGraph.getTimePicker(scene);
  timePicker?.onZoom();
}

function handleTimeRangeShift(scene: DashboardScene, direction: 'left' | 'right') {
  const timePicker = dashboardSceneGraph.getTimePicker(scene);

  if (!timePicker) {
    return;
  }

  if (direction === 'left') {
    timePicker.onMoveBackward();
  }
  if (direction === 'right') {
    timePicker.onMoveForward();
  }
}
