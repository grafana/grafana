const fs = require('fs-extra');
const path = require('path');

const destIconsDir = path.resolve(__dirname, '../public/img/icons/');
const sourceIconsDir = path.resolve(__dirname, '../packages/grafana-ui/src/icons/');

const lineDestDir = path.join(destIconsDir, 'unicons');
const solidDestDir = path.join(destIconsDir, 'solid');

if (!fs.pathExistsSync(lineDestDir)) {
  let uniconSourceDir = path.join(sourceIconsDir, 'unicons');
  fs.copySync(uniconSourceDir, lineDestDir);
}

if (!fs.pathExistsSync(solidDestDir)) {
  let uniconSourceDir = path.join(sourceIconsDir, 'solid');
  fs.copySync(uniconSourceDir, solidDestDir);
}
