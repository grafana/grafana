#!/bin/bash
source "/etc/profile"

apt-get --allow-insecure-repositories update
apt-get install --allow-unauthenticated -y build-essential wget git sudo adduser libfontconfig1 locate libnss3 libnspr4 libgdk-pixbuf2.0-0 libgtk-3-0 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0 libcairo2 libdbus-1-3 libxcomposite1 libxrender1 libxcursor1 libxi6 libxtst6 libxrandr2 libxss1 libasound2 libatk-bridge2.0-0 libatspi2.0-0 libcups2 jq xvfb net-tools git-lfs unzip pkg-config zip libaio1 libaio-dev

