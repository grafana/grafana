# Use old Debian (this has support into 2022) in order to ensure binary compatibility with older glibc's.
FROM debian:stretch-20200803-slim AS toolchain

ARG OSX_SDK_URL

ENV OSX_MIN=10.10 \
    CTNG=1.24.0 \
    # This is the last revision that builds on Debian Stretch
    OSX_CROSS_REV=a1d7d7a8d569f9f0b8c3140b8b32848dbcd62afa

# Use ARG so as not to persist environment variable in image
ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /tmp

# FIRST PART
# build osx64 toolchain (stripped of man documentation)
# the toolchain produced is not self contained, it needs clang at runtime
#
# SECOND PART
# build gcc (no g++) centos6-x64 toolchain
# doc: https://crosstool-ng.github.io/docs/
# apt-get should be all dep to build toolchain
# sed and 1st echo are for convenience to get the toolchain in /tmp/x86_64-centos6-linux-gnu
# other echo are to enable build by root (crosstool-NG refuse to do that by default)
# the last 2 rm are just to save some time and space writing docker layers
#
# THIRD PART
# build fpm and creates a set of deb from gem
# ruby2.0 depends on ruby1.9.3 which is install as default ruby
# rm/ln are here to change that
# created deb depends on rubygem-json but json gem is not build
# so do by hand

# might wanna make sure osx cross and the other tarball as well as the packages ends up somewhere other than tmp
# might also wanna put them as their own layer to not have to unpack them every time?

RUN apt-get update && \
    apt-get install -yq \
        clang patch libxml2-dev \
        build-essential \
        ca-certificates \
        curl            \
        git             \
        make            \
        cmake           \
        libssl-dev      \
        xz-utils        \
        lzma-dev
RUN git clone https://github.com/tpoechtrager/osxcross.git /tmp/osxcross && \
      cd /tmp/osxcross && git reset --hard $OSX_CROSS_REV
RUN curl -fL "${OSX_SDK_URL}" -o /tmp/osxcross/tarballs/$(echo "${OSX_SDK_URL}" | grep -E 'MacOSX[^?]+' -o)
RUN ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil
RUN UNATTENDED=1 OSX_VERSION_MIN=${OSX_MIN} /tmp/osxcross/build.sh
RUN rm -rf /tmp/osxcross/target/SDK/*/usr/share && \
    cd /tmp                                              && \
    tar cfJ osxcross.tar.xz osxcross/target              && \
    rm -rf /tmp/osxcross
RUN apt-get install -yq                     \
        unzip libtool-bin bison flex gawk gcc g++ gperf help2man libncurses5-dev make patch python-dev texinfo xz-utils
RUN curl -fL http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-${CTNG}.tar.xz | tar -xJ -C /tmp/
RUN cd /tmp/crosstool-ng-${CTNG}        && \
    ./configure --enable-local          && \
    make && \
    ./ct-ng x86_64-centos6-linux-gnu    && \
    sed -i '/CT_PREFIX_DIR=/d' .config  && \
    echo 'CT_PREFIX_DIR="/tmp/${CT_HOST:+HOST-${CT_HOST}/}${CT_TARGET}"' >> .config && \
    echo 'CT_EXPERIMENTAL=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT_SURE=y' >> .config && \
    ./ct-ng build
RUN cd /tmp && \
    rm /tmp/x86_64-centos6-linux-gnu/build.log.bz2 && \
    tar cfJ x86_64-centos6-linux-gnu.tar.xz x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/crosstool-ng-${CTNG}

ARG GOLANGCILINT_VERSION=1.30.0
ARG GOLANGCILINT_CHKSUM=c8e8fc5753e74d2eb489ad428dbce219eb9907799a57c02bcd8b80b4b98c60d4

RUN curl -fLO https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz
RUN echo ${GOLANGCILINT_CHKSUM} golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz | sha256sum --check --strict --status
RUN tar xf golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz
RUN mv golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64/golangci-lint /tmp/

# Base image to crossbuild grafana.
# Use old Debian (this has support into 2022) in order to ensure binary compatibility with older glibc's.
FROM debian:stretch-20200803

ENV GOVERSION=1.15.1 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=12.18.3-1nodesource1 \
    YARNVERSION=1.22.4-1 \
    GO111MODULE=on

# Use ARG so as not to persist environment variable in image
ARG DEBIAN_FRONTEND=noninteractive

COPY --from=toolchain /tmp/x86_64-centos6-linux-gnu.tar.xz /tmp/osxcross.tar.xz /tmp/
COPY --from=toolchain /tmp/golangci-lint /usr/local/bin

RUN apt-get update && \
    apt-get install -yq  \
        build-essential clang gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf gcc-mingw-w64-x86-64 \
        apt-transport-https \
        python-pip      \
        ca-certificates \
        curl            \
        libfontconfig1  \
        gcc             \
        g++             \
        git             \
        make            \
        rpm             \
        xz-utils        \
        expect          \
        gnupg2          \
        procps          \
        ruby            \
        ruby-dev        \
        rubygems        \
        unzip &&        \
    gem install -N fpm && \
    ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil && \
    curl -fsL https://deb.nodesource.com/setup_12.x | bash - && \
    apt-get update && apt-get install -yq nodejs=${NODEVERSION} && \
    curl -fsS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && apt-get install -yq yarn=${YARNVERSION} && \
    curl -fL https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz \
      | tar -xz -C /usr/local && \
    git clone https://github.com/raspberrypi/tools.git /opt/rpi-tools --depth=1 && \
    pip install codespell

# We build our own musl cross-compilers via the musl-cross-make project, on the same OS as this image's base image,
# to ensure compatibility. We also make sure to target musl 1.1.x, since musl 1.2.x introduces 64-bit time types
# that breaks compatibility on some 32-bit architectures (https://github.com/grafana/grafana/issues/23500).
#
# Use ARG so as not to persist environment variable in image
ARG CHKSUM_ARMV7_MUSL=5db487fb0a4aa61667de45a9cfbf7940360bd7256583b8a1e7810b4d9dd0e02a8aac737ca634b57bf269195e776ef503832ed22a6689a1c8fcdcc956f846bef7
ARG CHKSUM_ARMV8_MUSL=50f4899cc2f637dbc39470bbe307074ccf7f40da2ab730218d13a9f75d578266311db6a0785919dcdcb5e7ce4517b13ee8d4a56d76e6fca7c6d4c2510d71aa8b
ARG CHKSUM_AMD64_MUSL=493a79e9e29a1eab3fdff6435bac6509253d2e54ac30ad9098ce5da638bbb8ad18a7ebf3520bcaf2f9588befeff23402d8bbf54fa3809bfe18c984a4ecabcb12

# Install musl cross compilers
RUN cd /tmp && \
    curl -fLO https://grafana-downloads.storage.googleapis.com/compilers/arm-linux-musleabihf-cross.tgz && \
    ([ "$(sha512sum arm-linux-musleabihf-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_ARMV7_MUSL" ] || (echo "Mismatching checksums armv7"; exit 1)) && \
    tar xf arm-linux-musleabihf-cross.tgz && \
    rm arm-linux-musleabihf-cross.tgz && \
    curl -fLO https://grafana-downloads.storage.googleapis.com/compilers/aarch64-linux-musl-cross.tgz && \
    ([ "$(sha512sum aarch64-linux-musl-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_ARMV8_MUSL" ] || (echo "Mismatching checksums armv8"; exit 1)) && \
    tar xf aarch64-linux-musl-cross.tgz && \
    rm aarch64-linux-musl-cross.tgz && \
    curl -fLO https://grafana-downloads.storage.googleapis.com/compilers/x86_64-linux-musl-cross.tgz && \
    ([ "$(sha512sum x86_64-linux-musl-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_AMD64_MUSL" ] || (echo "Mismatching checksums amd64"; exit 1)) && \
    tar xf x86_64-linux-musl-cross.tgz && \
    rm x86_64-linux-musl-cross.tgz

RUN go get -u github.com/mgechev/revive@v1.0.2
RUN mv ${GOPATH}/bin/revive /usr/local/bin/

COPY ./bootstrap.sh /tmp/bootstrap.sh
