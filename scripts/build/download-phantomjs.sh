#!/bin/bash
set -eo pipefail

if [ ! -d '/tmp/phantomjs' ]; then
  _version="2.1.1"

  curl -fL https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$_version-windows.zip -o /tmp/phantomjs-win.zip
  [ "$(sha256sum /tmp/phantomjs-win.zip | cut -d' ' -f1)" = \
    "d9fb05623d6b26d3654d008eab3adafd1f6350433dfd16138c46161f42c7dcc8" ] || \
    (echo "Checksum mismatch phantomjs-$_version-windows.zip"; exit 1)
  curl -fL https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$_version-macosx.zip -o /tmp/phantomjs-mac.zip
  [ "$(sha256sum /tmp/phantomjs-mac.zip | cut -d' ' -f1)" = \
    "538cf488219ab27e309eafc629e2bcee9976990fe90b1ec334f541779150f8c1" ] || \
    (echo "Checksum mismatch phantomjs-$_version-mac.zip"; exit 1)

  cd /tmp
  unzip /tmp/phantomjs-win.zip
  unzip /tmp/phantomjs-mac.zip

  mkdir -p /tmp/phantomjs/windows /tmp/phantomjs/darwin

  cp /tmp/phantomjs-$_version-windows/bin/phantomjs.exe /tmp/phantomjs/windows/phantomjs.exe
  cp /tmp/phantomjs-$_version-macosx/bin/phantomjs /tmp/phantomjs/darwin/phantomjs
fi
