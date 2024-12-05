import { ClipboardEvent, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { DataFrame, PanelModel } from '@grafana/data';
import { SceneDataQuery, SceneDataTransformer, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { usePluginHooks } from 'app/features/plugins/extensions/usePluginHooks';

import { DashboardScene } from '../scene/DashboardScene';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { VizPanelMore } from './VizPanelMore';
import { VizPanelDelete } from './VizPanelDelete';

export interface FileImportResult {
  dataFrames: DataFrame[];
  file: File;
}

export function useDropAndPaste(dashboard: DashboardScene) {
  const { hooks: fileHooks } = usePluginHooks<(data: File | string) => Promise<string[]>>({
    extensionPointId: 'dashboard/grid',
    limitPerPlugin: 1,
  });
  const { hooks: pasteHooks } = usePluginHooks<(data: string) => Promise<PanelModel | null>>({
    extensionPointId: 'dashboard/dragndrop',
    limitPerPlugin: 1,
  });

  const onImportFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      for (const hook of fileHooks) {
        const result = await hook(file);
        console.log(result);
        for (const uid of result) {
          console.log(uid);
          const vizPanel = new VizPanel({
            pluginId: 'table',
            title: `JSON Data fetched from ${uid}`,
            menu: new VizPanelMenu({
              $behaviors: [panelMenuBehavior],
            }),
            $data: new SceneDataTransformer({
              $data: new SceneQueryRunner({
                queries: [
                  {
                    refId: 'A',
                    type: 'series',
                    source: 'unistore',
                    format: 'table',
                    dataset: uid,
                  },
                ],
                datasource: { uid: 'ee5sgnbe5wum8b', type: 'yesoreyeram-infinity-datasource' },
              }),
              transformations: [],
            }),
          });
          dashboard.addPanel(vizPanel);
        }
      }

      //alert(`Importing file: ${file.name}`);
    },
    [dashboard, fileHooks]
  );

  const onPaste = useCallback(
    async (event: ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = event.clipboardData;

      if (clipboardData.files.length > 0) {
        // Handle file paste
        onImportFile(clipboardData.files[0]);
        return;
      }

      if (clipboardData.types.includes('text/plain')) {
        // Handle plaintext paste
        const text = clipboardData.getData('text/plain');
        const results = await Promise.all(pasteHooks.map((h) => h(text)));
        const filtered = results.filter((x) => x != null);
        if (filtered.length == 0) {
          return;
        }
        const preferedViz = filtered.find((x) => x?.type == 'table') ?? filtered[0];
        const addPanel = (model: PanelModel) => {
          const panel = buildPanelFromModel(model);
          panel.setState({
            headerActions: [
              new VizPanelDelete({ onClick: () => dashboard.removePanel(panel) }),
              new VizPanelMore({
                actions: filtered.map((p) => ({
                  name: p.title ?? p.type,
                  onClick: () => {
                    dashboard.removePanel(panel);
                    addPanel(p);
                  },
                })),
              }),
            ],
          });
          dashboard.addPanel(panel);
        };
        addPanel(preferedViz);
        return;
      }

      if (clipboardData.types.includes('text/html')) {
        // Handle HTML paste
        const html = clipboardData.getData('text/html');
        for (const hook of pasteHooks) {
          hook(html);
        }
      }

      if (clipboardData.types.includes('image/png') || clipboardData.types.includes('image/jpeg')) {
        // Handle image paste
        // const image = clipboardData.items[0].getAsFile();
        alert('Pasted image - no preview available yet');
      }

      alert('Pasted data of unknown type');
    },
    [onImportFile]
  );

  const { getRootProps, isDragActive } = useDropzone({ onDrop: ([acceptedFile]) => onImportFile(acceptedFile) });

  return {
    getRootProps,
    isDragActive,
    onPaste,
  };
}

const buildPanelFromModel = (panel: PanelModel) => {
  return new VizPanel({
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    pluginId: panel.type,
    title: panel.title,
    options: panel.options,
    $data: createPanelDataProvider(panel),
  });
};
const createPanelDataProvider = (panel: PanelModel) => {
  if (!panel.targets || panel.targets?.length == 0) return undefined;
  const dataProvider = new SceneQueryRunner({
    datasource: panel.datasource ?? undefined,
    queries: (panel.targets as SceneDataQuery[]) ?? [],
  });
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.transformations ?? [],
  });
};
