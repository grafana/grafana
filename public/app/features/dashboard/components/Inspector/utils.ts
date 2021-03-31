import { saveAs } from 'file-saver';
import { CollectorItem } from './types';
import { safeStringifyValue } from '../../../../core/utils/explore';

export interface Packager {
  package: (items: CollectorItem[]) => string;
}

export function inspectPackager(): Packager {
  return {
    package: function (items: CollectorItem[]): string {
      const markdowns: string[] = [];
      const newline = '\n';

      markdowns.push(`#### Shared sanitized data from Grafana (${new Date().toISOString()})`);
      for (const item of items) {
        let markdown = '';
        markdown += `##### ${item.name}  `;
        markdown += newline;
        markdown += '<details>';
        markdown += newline;
        markdown += '<summary>details</summary>';
        markdown += newline;
        markdown += newline;
        markdown += '```json';
        markdown += newline;
        markdown += safeStringifyValue(item.data, 2);
        markdown += newline;
        markdown += '```';
        markdown += newline;
        markdown += '</details>';
        markdown += newline;
        markdowns.push(markdown);
      }

      return markdowns.join(newline);
    },
  };
}

export interface Downloader {
  startDownload: (data: string) => void;
}

export function inspectDownloader(): Downloader {
  return {
    startDownload: function (data): void {
      const blob = new Blob([String.fromCharCode(0xfeff), data], {
        type: 'text/plain;charset=utf-16',
      });
      const fileName = `Sanitized Grafana Report${new Date().toISOString()}.md`;
      saveAs(blob, fileName);
    },
  };
}
