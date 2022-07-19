FROM debian:testing-20210111-slim

# Use ARG so as not to persist environment variable in image
ARG GOVERSION=1.17.8 \
  GO_CHECKSUM=980e65a863377e69fd9b67df9d8395fd8e93858e7a24c9f55803421e453f4f99 \
  DEBIAN_FRONTEND=noninteractive

ENV PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go

RUN apt update && apt install -yq curl git make
RUN curl -fLO https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz && \
      echo "${GO_CHECKSUM} go${GOVERSION}.linux-amd64.tar.gz" | sha256sum --check --strict --status && \
      tar -xzf go${GOVERSION}.linux-amd64.tar.gz -C /usr/local

RUN git clone https://github.com/aptly-dev/aptly $GOPATH/src/github.com/aptly-dev/aptly
RUN cd $GOPATH/src/github.com/aptly-dev/aptly && \
    # pin aptly to a specific commit after 1.3.0 that contains gpg2 support
    git reset --hard a64807efdaf5e380bfa878c71bc88eae10d62be1 && \
    make install

FROM debian:testing-20210111-slim

# Use ARG so as not to persist environment variable in image
ARG DEBIAN_FRONTEND=noninteractive \
  GOOGLE_SDK_VERSION=325.0.0 \
  GOOGLE_SDK_CHECKSUM=374f960c9f384f88b6fc190b268ceac5dcad777301390107af63782bfb5ecbc7

# Need procps for pkill utility, which is used by the build pipeline tool to restart the GPG agent
RUN apt update && apt install -yq git curl python3-pip procps && pip3 install -U awscli crcmod && \
    curl -fLO https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz && \
    echo "${GOOGLE_SDK_CHECKSUM} google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz" | sha256sum --check --status && \
    tar xzf google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz -C /opt && \
    rm google-cloud-sdk-${GOOGLE_SDK_VERSION}-linux-x86_64.tar.gz && \
    apt update && \
    apt install -y createrepo-c expect && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    ln -s /opt/google-cloud-sdk/bin/gsutil /usr/bin/gsutil && \
    ln -s /opt/google-cloud-sdk/bin/gcloud /usr/bin/gcloud && \
    mkdir -p /deb-repo /rpm-repo && \
    ln -s /usr/bin/createrepo_c /usr/bin/createrepo

COPY --from=0 /go/bin/aptly /usr/local/bin/aptly
