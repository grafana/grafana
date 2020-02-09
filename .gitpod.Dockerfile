FROM gitpod/workspace-full

USER gitpod

ENV NODE_VERSION=v12.15.0

RUN bash -c ". .nvm/nvm.sh \
             && nvm install ${NODE_VERSION} \
             && nvm alias default ${NODE_VERSION} \
             && npm install -g yarn"
ENV PATH=/home/gitpod/.nvm/versions/node/${NODE_VERSION}/bin:$PATH
