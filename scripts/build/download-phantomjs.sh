#!/bin/bash -e

if [ ! -d '/tmp/phantomjs' ]; then
  _version="2.1.1"

  curl -L https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$_version-windows.zip > /tmp/phantomjs-win.zip
  curl -L https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$_version-macosx.zip > /tmp/phantomjs-mac.zip

  cd /tmp
  unzip /tmp/phantomjs-win.zip
  unzip /tmp/phantomjs-mac.zip

  mkdir -p /tmp/phantomjs/windows /tmp/phantomjs/darwin

  cp /tmp/phantomjs-$_version-windows/bin/phantomjs.exe /tmp/phantomjs/windows/phantomjs.exe
  cp /tmp/phantomjs-$_version-macosx/bin/phantomjs /tmp/phantomjs/darwin/phantomjs
fi
