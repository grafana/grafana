import fs = require('fs');
import path = require('path');

/**
 * Remove directory recursively
 * Ref https://stackoverflow.com/a/42505874
 */
export const rmdir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  fs.readdirSync(dirPath).forEach(entry => {
    const entryPath = path.join(dirPath, entry);
    if (fs.lstatSync(entryPath).isDirectory()) {
      rmdir(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  });

  fs.rmdirSync(dirPath);
};
