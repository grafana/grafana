import { ClipboardEvent, Component, ComponentType, useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { DataFrame, PanelModel, PasteHandler } from '@grafana/data';
import { SceneDataQuery, SceneDataTransformer, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { usePluginHooks } from 'app/features/plugins/extensions/usePluginHooks';

import { DashboardScene } from '../scene/DashboardScene';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { VizPanelMore } from './VizPanelMore';
import { VizPanelDelete } from './VizPanelDelete';
import { getBackendSrv } from '@grafana/runtime';

export interface FileImportResult {
  dataFrames: DataFrame[];
  file: File;
}

export function useDropAndPaste(dashboard: DashboardScene) {
  const [editComponent, setEditComponent] = useState<React.ReactNode | null>(null);
  const { hooks: fileHooks } = usePluginHooks<(data: File | string) => Promise<string[]>>({
    extensionPointId: 'dashboard/grid',
    limitPerPlugin: 1,
  });
  const { hooks: pasteHooks } = usePluginHooks<(data: string) => Promise<PasteHandler[] | null>>({
    extensionPointId: 'dashboard/dragndrop',
    limitPerPlugin: 1,
  });

  const onImportFile = useCallback(
    async (file?: File) => {
      if (!file) {
        return;
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = reader.result as string;

          const backendSrv = getBackendSrv();
          const payload = makeAPIFile(base64String, file.name);
          backendSrv.post('/apis/file.grafana.app/v0alpha1/namespaces/default/files', payload);
        };
        reader.readAsDataURL(file);

        //real URL should be I think http://localhost:3000/api/plugins/grafana-dragdroppaste-app/resources/file/${file.name}
        const mockUrl = 'http://localhost:3000/api/plugins/grafana-dragdroppaste-app/resources/ping';
        const vizPanel = new VizPanel({
          pluginId: 'canvas',
          title: `Image fetched from ${file.name}`,
          menu: new VizPanelMenu({
            $behaviors: [panelMenuBehavior],
          }),
          options: {
            infinitePan: false,
            inlineEditing: true,
            panZoom: false,
            root: {
              background: {
                color: {
                  fixed: 'transparent',
                },
                image: {
                  fixed: mockUrl,
                },
              },
              border: {
                color: {
                  fixed: 'dark-green',
                },
              },
              constraint: {
                horizontal: 'left',
                vertical: 'top',
              },
              elements: [],
              name: 'Element 1733410656032',
              oneClickMode: 'off',
              placement: {
                height: 100,
                left: 0,
                rotation: 0,
                top: 0,
                width: 100,
              },
              type: 'frame',
            },
            showAdvancedTypes: true,
          },
          $data: new SceneDataTransformer({
            $data: new SceneQueryRunner({
              queries: [
                {
                  queryType: 'randomWalk',
                  refId: 'A',
                },
              ],
              datasource: { uid: '-- Grafana --', type: 'grafana' },
            }),
            transformations: [],
          }),
        });
        dashboard.addPanel(vizPanel);

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
        const filtered = results.filter((x) => x !== null).flat();
        if (filtered.length === 0) {
          return;
        }
        const immediatePanels = filtered.filter((x) => x.panel !== null);
        const preferedViz = immediatePanels.find((x) => x.panel?.type === 'table') ?? immediatePanels[0];
        const addPanel = (model: PanelModel) => {
          const panel = buildPanelFromModel(model);
          panel.setState({
            headerActions: [
              new VizPanelDelete({ onClick: () => dashboard.removePanel(panel) }),
              new VizPanelMore({
                actions: filtered.map((p) => ({
                  name: p.title,
                  icon: p.icon,
                  onClick: () => {
                    if (p.panel != null) {
                      dashboard.removePanel(panel);
                      addPanel(p.panel);
                    } else if (p.component) {
                      setEditComponent(
                        <div>
                          <p.component
                            addPanel={(p) => {
                              dashboard.removePanel(panel);
                              addPanel(p);
                            }}
                            input={text}
                          />
                        </div>
                      );
                    }
                  },
                })),
              }),
            ],
          });
          dashboard.addPanel(panel);
          setEditComponent(null);
        };
        addPanel(preferedViz.panel!);
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
    [onImportFile, setEditComponent]
  );

  const { getRootProps, isDragActive } = useDropzone({ onDrop: ([acceptedFile]) => onImportFile(acceptedFile) });

  return {
    getRootProps,
    isDragActive,
    onPaste,
    editComponent,
    closeDrawer: () => {
      setEditComponent(null);
    },
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
const makeAPIFile = (fileData: string, name: string) => {
  return {
    kind: 'File',
    apiVersion: 'file.grafana.app/v0alpha1',
    metadata: {
      name: name,
    },
    spec: {
      title: name,
      description: 'description',
      data: [
        {
          type: 'image',
          name: name,
          contents: fileData,
        },
      ],
    },
  };
};
