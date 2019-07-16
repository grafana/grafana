import path = require('path');
import fs = require('fs');

interface ExtensionBytes {
  [key: string]: number;
}

export const getFileSizeReportInFolder = (dir: string, info?: ExtensionBytes): ExtensionBytes => {
  if (!info) {
    info = {};
  }

  const files = fs.readdirSync(dir);
  if (files) {
    files.forEach(file => {
      const newbase = path.join(dir, file);
      const stat = fs.statSync(newbase);
      if (stat.isDirectory()) {
        getFileSizeReportInFolder(newbase, info);
      } else {
        let ext = '<other>';
        const idx = file.lastIndexOf('.');
        if (idx > 0) {
          ext = file.substring(idx + 1).toLowerCase();
        }
        const current = info![ext] || 0;
        info![ext] = current + stat.size;
      }
    });
  }
  return info;
};
