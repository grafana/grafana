FROM ubuntu:14.04 as centostoolchain

# doc: https://crosstool-ng.github.io/docs/
# apt-get should be all dep to build toolchain
# sed and 1st echo are for convinience to get the toolchain in /tmp/x86_64-centos6-linux-gnu
# other echo are to enable build by root (crosstool-NG refuse to do that by default) 
# the last 2 rm are just to save some time and space writing docker layers
RUN apt-get update   && \
    apt-get install -y  \
        bison curl flex gawk gcc g++ gperf help2man libncurses5-dev make patch python-dev texinfo xz-utils && \
    curl -L http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-1.23.0.tar.xz  \
         | tar -xJ -C /tmp/             && \
    cd /tmp/crosstool-ng-1.23.0         && \  
    ./configure --enable-local          && \
    make                                && \
    ./ct-ng x86_64-centos6-linux-gnu    && \
    sed -i '/CT_PREFIX_DIR=/d' .config  && \
    echo 'CT_PREFIX_DIR="/tmp/${CT_HOST:+HOST-${CT_HOST}/}${CT_TARGET}"' >> .config && \
    echo 'CT_EXPERIMENTAL=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT_SURE=y' >> .config && \
    ./ct-ng build                       && \
    cd /tmp                             && \
    rm /tmp/x86_64-centos6-linux-gnu/build.log.bz2 && \
    tar cvfJ x86_64-centos6-linux-gnu.tar.xz x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/crosstool-ng-1.23.0

# base image to crossbuild grafana
FROM ubuntu:14.04

ENV GOVERSION=1.10 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=6.13.0 \
    OSX_SDK_URL=https://s3.dockerproject.org/darwin/v2/ \
    OSX_SDK=MacOSX10.11.sdk.tar.xz

COPY --from=centostoolchain /tmp/x86_64-centos6-linux-gnu.tar.xz /tmp/

#apt-get
# - 1st line is for toolchains
# - libfontconfig1 is a phantomjs dep
# - rpm is for fpm runtime (only used when building .rpm)
# - ruby2.0, ruby2.0-dev, xz-utils are to build fpm
RUN apt-get update   && \
    apt-get install -y  \
        gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf gcc-mingw-w64-x86-64 clang-3.8 patch libxml2-dev \
        apt-transport-https \
        binutils        \
        bzip2           \
        ca-certificates \
        curl            \
        libc-dev        \
        libfontconfig1  \
        g++             \
        gcc             \
        git             \
        make            \
        python          \
        rpm             \
        ruby2.0         \
        ruby2.0-dev     \
        xz-utils     && \
        gem2.0 install --no-ri --no-rdoc fpm && \
    curl -L https://nodejs.org/dist/v${NODEVERSION}/node-v${NODEVERSION}-linux-x64.tar.xz \
      | tar -xJ --strip-components=1 -C /usr/local                         && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -      && \
    echo "deb [arch=amd64] https://dl.yarnpkg.com/debian/ stable main"        \
      | tee /etc/apt/sources.list.d/yarn.list                              && \
    apt-get update && apt-get install --no-install-recommends yarn         && \
    curl -L https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz \
      | tar -xz -C /usr/local                                              && \
    git clone https://github.com/tpoechtrager/osxcross.git  /tmp/osxcross  && \
    curl -L ${OSX_SDK_URL}/${OSX_SDK} -o /tmp/osxcross/tarballs/${OSX_SDK} && \
    ln -s /usr/bin/clang-3.8 /usr/bin/clang                                && \
    ln -s /usr/bin/clang++-3.8 /usr/bin/clang++                            && \
    ln -s /usr/bin/llvm-dsymutil-3.8 /usr/bin/dsymutil                     && \
    UNATTENDED=yes OSX_VERSION_MIN=10.6 /tmp/osxcross/build.sh             && \
    rm -rf /tmp/osxcross/tarballs /tmp/osxcross/.git







