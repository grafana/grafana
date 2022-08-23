const fs = require('fs-extra');
const path = require('path');

const iconsDir = path.resolve(__dirname, '../public/img/icons/');
const lineDestDir = path.join(iconsDir, 'unicons');

if (!fs.pathExistsSync(lineDestDir)) {
  let uniconSourceDir = path.join(
    path.dirname(require.resolve('iconscout-unicons-tarball/package.json')),
    'unicons/svg/line'
  );
  fs.copySync(uniconSourceDir, lineDestDir);
}

let solidDestDir = path.join(iconsDir, 'solid');

if (!fs.pathExistsSync(solidDestDir)) {
  let uniconSourceDir = path.join(
    path.dirname(require.resolve('iconscout-unicons-tarball/package.json')),
    'unicons/svg/solid'
  );
  fs.copySync(uniconSourceDir, solidDestDir);
}
