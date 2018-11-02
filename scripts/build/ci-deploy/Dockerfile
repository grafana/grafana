FROM circleci/python:2.7-stretch

RUN sudo pip install awscli && \
  curl https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-222.0.0-linux-x86_64.tar.gz | \
  sudo tar xvzf - -C /opt
