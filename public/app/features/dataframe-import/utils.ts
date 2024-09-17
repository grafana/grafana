import { Accept } from 'react-dropzone';
import { Observable } from 'rxjs';

import { toDataFrame } from '@grafana/data';

import { FileImportResult } from './types';

function getFileExtensions(acceptedFiles: Accept) {
  const fileExtentions = new Set<string>();
  Object.keys(acceptedFiles).forEach((v) => {
    acceptedFiles[v].forEach((extension) => {
      fileExtentions.add(extension);
    });
  });
  return fileExtentions;
}

export function formatFileTypes(acceptedFiles: Accept) {
  const fileExtentions = Array.from(getFileExtensions(acceptedFiles));
  if (fileExtentions.length === 1) {
    return fileExtentions[0];
  }
  return `${fileExtentions.slice(0, -1).join(', ')} or ${fileExtentions.slice(-1)}`;
}

export function filesToDataframes(files: File[]): Observable<FileImportResult> {
  return new Observable<FileImportResult>((subscriber) => {
    let completedFiles = 0;
    import('app/core/utils/sheet')
      .then((sheet) => {
        files.forEach((file) => {
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);
          reader.onload = () => {
            const result = reader.result;
            if (result && result instanceof ArrayBuffer) {
              if (file.type === 'application/json') {
                const decoder = new TextDecoder('utf-8');
                const json = JSON.parse(decoder.decode(result));
                subscriber.next({ dataFrames: [toDataFrame(json)], file: file });
              } else {
                subscriber.next({ dataFrames: sheet.readSpreadsheet(result), file: file });
              }
              if (++completedFiles >= files.length) {
                subscriber.complete();
              }
            }
          };
        });
      })
      .catch(() => {
        throw 'Failed to load sheets module';
      });
  });
}
