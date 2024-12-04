import { DataFrame } from '@grafana/data';
import { usePluginHooks } from 'app/features/plugins/extensions/usePluginHooks';
import { ClipboardEvent, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Observable } from 'rxjs';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanel, VizPanelMenu } from '@grafana/scenes';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';

export interface FileImportResult {
  dataFrames: DataFrame[];
  file: File;
}

export function useDropAndPaste(dashboard: DashboardScene) {
  const { hooks: fileHooks } = usePluginHooks<(data: File | string) => Observable<FileImportResult>>({
    extensionPointId: 'dashboard/grid',
    limitPerPlugin: 1,
  });
  const { hooks: pasteHooks } = usePluginHooks<(data: File | string) => VizPanel | null>({
    extensionPointId: 'dashboard/dragndrop',
    limitPerPlugin: 1,
  });

  const onImportFile = useCallback(
    (file?: File) => {
      if (!file) {
        return;
      }

      for (const hook of fileHooks) {
        const result = hook(file);
        result.subscribe((x) => console.log(x));
      }

      //alert(`Importing file: ${file.name}`);
    },
    [fileHooks]
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = event.clipboardData;

      if (clipboardData.files.length > 0) {
        // Handle file paste
        onImportFile(clipboardData.files[0]);
        return;
      }

      if (clipboardData.types.includes('text/plain')) {
        // Handle plaintext paste
        const text = clipboardData.getData('text/plain');
        for (const hook of pasteHooks) {
          const result = hook(text);
          if (result instanceof VizPanel) {
            result.setState({
              titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
              menu: new VizPanelMenu({
                $behaviors: [panelMenuBehavior],
              }),
            });
            dashboard.addPanel(result);
          }
        }
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
