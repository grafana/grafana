FROM circleci/node:12-browsers
USER root 
ADD scripts scripts
WORKDIR scripts
RUN ./deploy.sh
ADD install/gget /usr/local/bin/gget
