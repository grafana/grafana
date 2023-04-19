# Use old Debian (this has support into 2022) in order to ensure binary compatibility with older glibc's.
FROM debian:stretch-20210208 AS toolchain

ENV OSX_MIN=10.10 \
    CTNG=1.24.0 \
    CTNG_CHKSUM=89b8794a4184ad4928750e29712ed4f194aa1d0b93768d67ff64f30c30f1b1e165647cafc6de94d68d3ef70e50446e544dad65aa36137511a32ee7a667dddfb4 \
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
COPY MacOSX10.15.sdk.tar.xz /tmp/osxcross/tarballs/
RUN ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil
RUN UNATTENDED=1 OSX_VERSION_MIN=${OSX_MIN} /tmp/osxcross/build.sh
RUN rm -rf /tmp/osxcross/target/SDK/*/usr/share && \
    cd /tmp                                              && \
    tar cfJ osxcross.tar.xz osxcross/target              && \
    rm -rf /tmp/osxcross
RUN apt-get install -yq                     \
        unzip libtool-bin bison flex gawk gcc g++ gperf help2man libncurses5-dev make patch python-dev texinfo xz-utils
RUN curl -fLO http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-${CTNG}.tar.xz
RUN echo $CTNG_CHKSUM crosstool-ng-${CTNG}.tar.xz | sha512sum --check --strict --status
RUN tar xf crosstool-ng-${CTNG}.tar.xz
RUN cd /tmp/crosstool-ng-${CTNG}        && \
    ./configure --enable-local          && \
    make && \
    ./ct-ng x86_64-centos6-linux-gnu    && \
    sed -i '/CT_PREFIX_DIR=/d' .config  && \
    echo 'CT_PREFIX_DIR="/tmp/${CT_HOST:+HOST-${CT_HOST}/}${CT_TARGET}"' >> .config && \
    echo 'CT_EXPERIMENTAL=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT_SURE=y' >> .config && \
    mkdir -p .build/tarballs && \
    cd .build/tarballs && \
    curl -fLO https://libisl.sourceforge.io/isl-0.20.tar.gz && \
    curl -fLO https://github.com/libexpat/libexpat/releases/download/R_2_1_0/expat-2.1.0.tar.gz && \
    cd - && \
    ./ct-ng build
RUN cd /tmp && \
    rm /tmp/x86_64-centos6-linux-gnu/build.log.bz2 && \
    tar cfJ x86_64-centos6-linux-gnu.tar.xz x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/crosstool-ng-${CTNG}

ARG GOLANGCILINT_VERSION=1.49.0
ARG GOLANGCILINT_CHKSUM=5badc6e9fee2003621efa07e385910d9a88c89b38f6c35aded153193c5125178

RUN curl -fLO https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCILINT_VERSION}/golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz
RUN echo ${GOLANGCILINT_CHKSUM} golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz | sha256sum --check --strict --status
RUN tar xf golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64.tar.gz
RUN mv golangci-lint-${GOLANGCILINT_VERSION}-linux-amd64/golangci-lint /tmp/

ARG SHELLCHECK_VERSION=0.7.1
ARG SHELLCHECK_CHKSUM=beca3d7819a6bdcfbd044576df4fc284053b48f468b2f03428fe66f4ceb2c05d9b5411357fa15003cb0311406c255084cf7283a3b8fce644c340c2f6aa910b9f
RUN curl -fLO http://storage.googleapis.com/grafana-downloads/ci-dependencies/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz
RUN echo $SHELLCHECK_CHKSUM shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz | sha512sum --check --strict --status
RUN tar xf shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz && mv shellcheck-v${SHELLCHECK_VERSION}/shellcheck /tmp/

ARG CUE_VERSION=0.3.0-alpha5
ARG CUE_CHKSUM=9d3131e470cdb5182afd9966688f1c052d383145cce005a947156b5591da39b7
RUN curl -fLO https://github.com/cuelang/cue/releases/download/v${CUE_VERSION}/cue_${CUE_VERSION}_Linux_x86_64.tar.gz
RUN echo $CUE_CHKSUM cue_${CUE_VERSION}_Linux_x86_64.tar.gz | sha256sum --check --strict --status
RUN tar xf cue_${CUE_VERSION}_Linux_x86_64.tar.gz -C /tmp cue

ARG DOCKERIZE_VERSION=0.6.1
RUN curl -fLO https://github.com/jwilder/dockerize/releases/download/v${DOCKERIZE_VERSION}/dockerize-linux-amd64-v${DOCKERIZE_VERSION}.tar.gz
RUN tar -xzvf dockerize-linux-amd64-v${DOCKERIZE_VERSION}.tar.gz -C /tmp/
RUN rm dockerize-linux-amd64-v${DOCKERIZE_VERSION}.tar.gz

# Base image to crossbuild grafana.
# Use old Debian (this has support into 2022) in order to ensure binary compatibility with older glibc's.
FROM debian:stretch-20210208

ENV GOVERSION=1.19.8 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=16.14.0-1nodesource1 \
    YARNVERSION=1.22.15-1

# Use ARG so as not to persist environment variable in image
ARG DEBIAN_FRONTEND=noninteractive

COPY --from=toolchain /tmp/x86_64-centos6-linux-gnu.tar.xz /tmp/osxcross.tar.xz /tmp/
COPY --from=toolchain /tmp/golangci-lint /usr/local/bin/
COPY --from=toolchain /tmp/shellcheck /usr/local/bin/
COPY --from=toolchain /tmp/cue /usr/local/bin/
COPY --from=toolchain /tmp/dockerize /usr/local/bin/

RUN apt-get update && \
    apt-get install -yq  \
        build-essential netcat-traditional clang gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf gcc-mingw-w64-x86-64 \
        apt-transport-https \
        python-pip      \
        ca-certificates \
        curl            \
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
    gem install -N public_suffix -v 4.0.7 && \
    gem install --conservative -N fpm && \
    ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil && \
    curl -fsS https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -  && \
    curl -O https://deb.nodesource.com/node_16.x/pool/main/n/nodejs/nodejs_${NODEVERSION}_amd64.deb &&\
    dpkg -i nodejs_${NODEVERSION}_amd64.deb &&\
    rm nodejs_${NODEVERSION}_amd64.deb &&\
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

RUN go install github.com/mgechev/revive@v1.0.2 && \
  mv ${GOPATH}/bin/revive /usr/local/bin/ && \
  go install github.com/google/go-jsonnet/cmd/jsonnetfmt@latest && \
  mv ${GOPATH}/bin/jsonnetfmt /usr/local/bin/ && \
  go install github.com/monitoring-mixins/mixtool/cmd/mixtool@latest && \
  mv ${GOPATH}/bin/mixtool /usr/local/bin/

COPY ./bootstrap.sh /tmp/bootstrap.sh
