FROM circleci/golang:1.13

RUN git clone https://github.com/aptly-dev/aptly $GOPATH/src/github.com/aptly-dev/aptly && \
    cd $GOPATH/src/github.com/aptly-dev/aptly && \
    # pin aptly to a specific commit after 1.3.0 that contains gpg2 support
    git reset --hard a64807efdaf5e380bfa878c71bc88eae10d62be1 && \
    make install

FROM circleci/python:2.7-stretch-node

USER root

RUN pip install -U awscli crcmod && \
    curl https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-222.0.0-linux-x86_64.tar.gz | \
      tar xvzf - -C /opt && \
    apt update && \
    apt install -y createrepo expect && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    ln -s /opt/google-cloud-sdk/bin/gsutil /usr/bin/gsutil && \
    ln -s /opt/google-cloud-sdk/bin/gcloud /usr/bin/gcloud && \
    mkdir -p /deb-repo /rpm-repo && \
    chown circleci:circleci /deb-repo /rpm-repo

COPY --from=0 /go/bin/aptly /usr/local/bin/aptly

USER circleci
