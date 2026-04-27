import { Observable } from 'rxjs';

import { toDataFrame } from '@grafana/data/dataframe';
import { readCSV } from '@grafana/data/utils';

import { type FileImportResult } from './types';

export function filesToDataframes(files: File[]): Observable<FileImportResult> {
  return new Observable<FileImportResult>((subscriber) => {
    let completedFiles = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = () => {
        const result = reader.result;
        if (result && result instanceof ArrayBuffer) {
          const decoder = new TextDecoder('utf-8');
          const fileString = decoder.decode(result);
          if (file.type === 'application/json') {
            const json = JSON.parse(fileString);
            subscriber.next({ dataFrames: [toDataFrame(json)], file: file });
          } else {
            subscriber.next({ dataFrames: readCSV(fileString), file: file });
          }
          if (++completedFiles >= files.length) {
            subscriber.complete();
          }
        }
      };
    });
  });
}
