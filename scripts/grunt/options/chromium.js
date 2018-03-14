

module.exports = function (config, grunt) {
  'use strict';

  const request = require('request-promise-native');
  const extract = require('extract-zip');
  const fs = require('fs');
  const mkdirp = require('mkdirp');
  const os = require('os');
  const path = require('path');

  function extractZip(file, dir) {
    return new Promise(fulfill => extract(file, { dir: path.resolve(dir) }, fulfill));
  }

  grunt.registerTask('chromium', 'Download chromium to tools', function () {

    // make task async
    var done = this.async();

    const chromium_revision = grunt.file.readJSON('./package.json').grafana.chromium_revision;
    const dest = `./tools/chromium/${chromium_revision}`;
    const downloadURLs = {
      linux: `https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${chromium_revision}/chrome-linux.zip`,
      mac: `https://storage.googleapis.com/chromium-browser-snapshots/Mac/${chromium_revision}/chrome-mac.zip`,
      win32: `https://storage.googleapis.com/chromium-browser-snapshots/Win/${chromium_revision}/chrome-win32.zip`,
      win64: `https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${chromium_revision}/chrome-win32.zip`,
    };

    var platform = os.platform();
    if (platform === 'win32') {
      platform = os.arch() === 'x64' ? 'win64' : 'win32';
    } else if (platform === 'darwin') {
      platform = 'mac';
    }

    const downloadSrc = downloadURLs[platform];
    const downloadTarget = `./tools/chromium/chromium-${platform}-${chromium_revision}.zip`;

    mkdirp.sync(dest);

    if (fs.existsSync(downloadTarget)) {
      // blindly assume that also unpacking succeeded
      grunt.log.writeln(`Chrome ${chromium_revision} already downloaded`);
      done();
    } else {
      grunt.log.writeln(`Downloading ${downloadSrc} to ${downloadTarget}`);
      request.get(downloadSrc)
        .on('error', (err) => {
          grunt.log.error(`Download of ${downloadSrc} to ${downloadTarget} failed: ${err}`);
          done(err);
        })
        .pipe(fs.createWriteStream(downloadTarget))
        .on('error', (err) => {
          grunt.log.error(`Saving of ${downloadSrc} to ${downloadTarget} failed: ${err}`);
          done(err);
        })
        .on('finish', () => {
          // unzip
          grunt.log.writeln(`Unpacking ${downloadTarget} to ${dest}`);

          return extractZip(downloadTarget, dest).then((err) => {
            if (err) {
              grunt.log.error(`Failed to unpack: ${err}`);
            }
            done(err);
          });
        });
    }
  });
};
