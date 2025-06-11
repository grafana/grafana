import { css } from '@emotion/css';
import React, { useCallback, ClipboardEvent, useState, ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';

import { PluginExtensionPoints, PluginExtensionDropAndPasteResponse, GrafanaTheme2, PanelModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Drawer, useStyles2 } from '@grafana/ui';
import { PanelModel as DashboardPanelModel } from 'app/features/dashboard/state/PanelModel';
import { usePluginFunctions } from 'app/features/plugins/extensions/usePluginFunctions';

import { DashboardScene } from '../dashboard-scene/scene/DashboardScene';
import { buildVizPanelForPanel } from '../dashboard-scene/serialization/transformSaveModelToScene';

import { DashboardDropOverlay } from './DashboardDropOverlay';
import { VizPanelAlternatives } from './VizPanelAlternatives';

interface Props {
  dashboard: DashboardScene;
  children?: React.ReactNode;
}

export function DropAndPasteWrapper(props: Props) {
  if (!config.featureToggles.dashboardDropAndPaste) {
    return <>{props.children}</>;
  }
  return <DropAndPasteContainer {...props} />;
}
function DropAndPasteContainer({ dashboard, children }: Props) {
  const styles = useStyles2(getStyles);
  const { functions: fileHooks } = usePluginFunctions<
    (data: File) => Promise<PluginExtensionDropAndPasteResponse[] | null>
  >({
    extensionPointId: PluginExtensionPoints.DashboardDropzone,
    limitPerPlugin: 1,
  });
  const [editComponent, setEditComponent] = useState<ReactNode | null>(null);
  const filteredFileHooks =
    config.pluginEnableDropAndPasteHook.length > 0
      ? fileHooks.filter((x) => x.pluginId in config.pluginEnableDropAndPasteHook)
      : fileHooks;
  const { functions: pasteHooks } = usePluginFunctions<
    (data: DataTransfer) => Promise<PluginExtensionDropAndPasteResponse[] | null>
  >({
    extensionPointId: PluginExtensionPoints.DashboardPaste,
    limitPerPlugin: 1,
  });
  const filteredPasteHooks =
    config.pluginEnableDropAndPasteHook.length > 0
      ? pasteHooks.filter((x) => x.pluginId in config.pluginEnableDropAndPasteHook)
      : pasteHooks;

  const addResults = useCallback(
    (results: Array<PluginExtensionDropAndPasteResponse[] | null>) => {
      const filteredResults = results
        .filter((x) => x !== null)
        .flat()
        .sort((a, b) => a.confidence - b.confidence);
      if (filteredResults.length === 0) {
        return;
      }
      const firstPanel = filteredResults.find((x) => !!x.panel);
      const firstComponent = filteredResults.find((x) => !!x.component);
      const addPanel = (panel: PanelModel) => {
        const vizPanel = buildVizPanelForPanel(new DashboardPanelModel(panel));
        vizPanel.setState({
          headerActions: [
            new VizPanelAlternatives({
              actions: filteredResults.map((p) => ({
                name: p.title,
                icon: p.icon,
                onClick: () => {
                  if (p.component) {
                    setEditComponent(
                      <p.component
                        addPanel={(p) => {
                          dashboard.removePanel(vizPanel);
                          setEditComponent(null);
                          addPanel(p);
                        }}
                      />
                    );
                  } else if (p.panel != null) {
                    dashboard.removePanel(vizPanel);
                    addPanel(p.panel);
                  }
                },
              })),
            }),
          ],
        });
        dashboard.addPanel(vizPanel);
      };
      if (firstPanel) {
        addPanel(firstPanel.panel!);
      } else if (firstComponent?.component) {
        setEditComponent(<firstComponent.component addPanel={addPanel} />);
      }
    },
    [dashboard, setEditComponent]
  );
  const onImportFile = useCallback(
    async (f: File) => {
      const results = await Promise.all(filteredFileHooks.map((hook) => hook.fn(f)));
      addResults(results);
    },
    [filteredFileHooks, addResults]
  );
  const onPaste = useCallback(
    async (e: ClipboardEvent) => {
      const results = await Promise.all(filteredPasteHooks.map((hook) => hook.fn(e.clipboardData)));
      addResults(results);
    },
    [filteredPasteHooks, addResults]
  );
  const { getRootProps, isDragActive } = useDropzone({ onDrop: ([acceptedFile]) => onImportFile(acceptedFile) });
  return (
    <div {...getRootProps({ className: styles.wrapper })} onPaste={onPaste}>
      {children}
      {isDragActive && <DashboardDropOverlay />}
      {editComponent != null && (
        <Drawer
          onClose={() => {
            setEditComponent(null);
          }}
        >
          {editComponent}
        </Drawer>
      )}
    </div>
  );
}
function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
  };
}
