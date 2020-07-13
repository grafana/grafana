FROM node:12.18-buster-slim

WORKDIR /root

RUN apt-get update && apt-get install -yq gnupg netcat curl
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
  echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list && \
  # Cypress dependencies
  apt-get update && apt-get install -yq libgtk2.0-0 libgtk-3-0 libnotify-dev libgconf-2-4 libnss3 libxss1 \
    libasound2 libxtst6 xauth xvfb google-chrome-stable && \
  apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
