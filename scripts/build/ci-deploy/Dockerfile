FROM debian:bullseye-slim

# Use ARG so as not to persist environment variable in image
ARG GOVERSION=1.18.1 \
  GO_CHECKSUM=b3b815f47ababac13810fc6021eb73d65478e0b2db4b09d348eefad9581a2334 \
  DEBIAN_FRONTEND=interactive

ENV PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go

RUN apt update && apt install -yq curl git make
RUN curl -fLO https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz && \
      echo "${GO_CHECKSUM} go${GOVERSION}.linux-amd64.tar.gz" | sha256sum --check --strict --status && \
      tar -xzf go${GOVERSION}.linux-amd64.tar.gz -C /usr/local

RUN git clone https://github.com/aptly-dev/aptly $GOPATH/src/github.com/aptly-dev/aptly
RUN cd $GOPATH/src/github.com/aptly-dev/aptly && \
    make install

FROM debian:testing-20210111-slim

# Use ARG so as not to persist environment variable in image
ARG DEBIAN_FRONTEND=noninteractive \
  GOOGLE_SDK_VERSION=384.0.1 \
  GOOGLE_SDK_CHECKSUM=437539933ce68aed7147bd03173d53e1c3d69c0694c107bc25e5f8309f29ccb8 \
  GCSFUSE_VERSION=0.41.1

# Need procps for pkill utility, which is used by the build pipeline tool to restart the GPG agent
RUN apt update && apt install -yq curl python3-pip procps && pip3 install -U awscli crcmod && \
    curl -fLO https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz && \
    echo "${GOOGLE_SDK_CHECKSUM} google-cloud-cli-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz" | sha256sum --check --status && \
    tar xzf google-cloud-cli-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz -C /opt && \
    rm google-cloud-cli-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz && \
    apt update && \
    apt install -y createrepo-c expect fuse && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    ln -s /opt/google-cloud-sdk/bin/gsutil /usr/bin/gsutil && \
    ln -s /opt/google-cloud-sdk/bin/gcloud /usr/bin/gcloud && \
    mkdir -p /deb-repo /rpm-repo && \
    ln -s /usr/bin/createrepo_c /usr/bin/createrepo \
    curl -L -O https://github.com/GoogleCloudPlatform/gcsfuse/releases/download/v${GCSFUSE_VERSION}/gcsfuse_${GCSFUSE_VERSION}_amd64.deb && \
    dpkg --install gcsfuse_${GCSFUSE_VERSION}_amd64.deb && \
    rm -Rf gcsfuse_${GCSFUSE_VERSION}_amd64.deb

COPY --from=0 /go/bin/aptly /usr/local/bin/aptly
