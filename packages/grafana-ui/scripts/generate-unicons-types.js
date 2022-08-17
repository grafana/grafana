const fs = require('fs');
const os = require('os');
const path = require('path');

const uniconsPath = path.join(__dirname, '../../../public/img/icons/unicons');
const iconsTypeFile = path.join(__dirname, '../src/types/unicons.d.ts');

const files = fs.readdirSync(uniconsPath);
const icons = [];

// loop through files, filter out non-svg files and trim the extension
for (const file of files) {
  if (file.endsWith('.svg')) {
    const name = file.substring(0, file.length - 4);
    icons.push(`'${name}'`);
  }
}

const iconsType = `export type AllUnicons =\n  | ${icons.join('\n  | ')};\n`;

fs.writeFileSync(iconsTypeFile, iconsType);
