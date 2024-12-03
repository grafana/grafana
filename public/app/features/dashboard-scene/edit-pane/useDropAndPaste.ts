import { ClipboardEvent, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export function useDropAndPaste() {
  const onImportFile = useCallback((file?: File) => {
    if (!file) {
      return;
    }

    alert(`Importing file: ${file.name}`);
  }, []);

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
        alert(`Pasted text: \n${text}`);

        return;
      }

      if (clipboardData.types.includes('text/html')) {
        // Handle HTML paste
        const html = clipboardData.getData('text/html');
        alert(`Pasted HTML:\n${html}`);
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
