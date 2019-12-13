FROM ubuntu:18.04 as toolchain

ENV OSX_SDK_URL=https://s3.dockerproject.org/darwin/v2/ \
    OSX_SDK=MacOSX10.10.sdk \
    OSX_MIN=10.10 \
    CTNG=1.24.0 \
    OSX_CROSS_REV=542acc2ef6c21aeb3f109c03748b1015a71fed63

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

RUN apt-get update   && \
    apt-get upgrade -yq && \
    apt-get install -yq \
        clang patch libxml2-dev \
        ca-certificates \
        curl            \
        git             \
        make            \
        cmake           \
        libssl-dev      \
        xz-utils        \
        lzma-dev
RUN git clone https://github.com/tpoechtrager/osxcross.git /tmp/osxcross && \
    cd /tmp/osxcross && git reset --hard $OSX_CROSS_REV && \
    curl -L ${OSX_SDK_URL}/${OSX_SDK}.tar.xz -o /tmp/osxcross/tarballs/${OSX_SDK}.tar.xz && \
    ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil
RUN UNATTENDED=yes OSX_VERSION_MIN=${OSX_MIN} /tmp/osxcross/build.sh
RUN rm -rf /tmp/osxcross/target/SDK/${OSX_SDK}/usr/share && \
    cd /tmp                                              && \
    tar cfJ osxcross.tar.xz osxcross/target              && \
    rm -rf /tmp/osxcross && \
    apt-get install -y                     \
        unzip libtool-bin bison curl flex gawk gcc g++ gperf help2man libncurses5-dev make patch python-dev texinfo xz-utils && \
    curl -L http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-${CTNG}.tar.xz  \
         | tar -xJ -C /tmp/             && \
    cd /tmp/crosstool-ng-${CTNG}        && \
    ./configure --enable-local          && \
    make && \
    ./ct-ng x86_64-centos6-linux-gnu    && \
    sed -i '/CT_PREFIX_DIR=/d' .config  && \
    echo 'CT_PREFIX_DIR="/tmp/${CT_HOST:+HOST-${CT_HOST}/}${CT_TARGET}"' >> .config && \
    echo 'CT_EXPERIMENTAL=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT=y' >> .config && \
    echo 'CT_ALLOW_BUILD_AS_ROOT_SURE=y' >> .config && \
    ./ct-ng build                       && \
    cd /tmp                             && \
    rm /tmp/x86_64-centos6-linux-gnu/build.log.bz2 && \
    tar cfJ x86_64-centos6-linux-gnu.tar.xz x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/crosstool-ng-${CTNG}

# base image to crossbuild grafana
FROM ubuntu:18.04

ENV GOVERSION=1.13.4 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=12.13.0

ARG DEBIAN_FRONTEND=noninteractive

COPY --from=toolchain /tmp/x86_64-centos6-linux-gnu.tar.xz /tmp/osxcross.tar.xz /tmp/

RUN apt-get update && \
    apt-get upgrade -yq && \
    apt-get install -yq  \
        clang gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf gcc-mingw-w64-x86-64 \
        apt-transport-https \
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
        unzip &&        \
    ln -s /usr/bin/llvm-dsymutil-6.0 /usr/bin/dsymutil                  && \
    curl -L https://nodejs.org/dist/v${NODEVERSION}/node-v${NODEVERSION}-linux-x64.tar.xz \
      | tar -xJ --strip-components=1 -C /usr/local                      && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -   && \
    echo "deb [arch=amd64] https://dl.yarnpkg.com/debian/ stable main"     \
      | tee /etc/apt/sources.list.d/yarn.list                           && \
    apt-get update && apt-get install -yq --no-install-recommends yarn      && \
    curl -L https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz \
      | tar -xz -C /usr/local && \
    git clone https://github.com/raspberrypi/tools.git /opt/rpi-tools --depth=1

ARG CHKSUM_ARMV7_MUSL=76c5539aed3d46d61c66d60757dd4083ab05420e4252aca04eaeb791e3342dac
ARG CHKSUM_ARMV8_MUSL=6d4f7249e067ef6d054bcebe9eaf0c581972767f86ad78d2b53d832d1126c52e
ARG CHKSUM_AMD64_MUSL=8c487b0f56bf600008e8f37041cbce37f6fe1e001acd3eca8bb16e30e16e8ae7

# Install musl cross compilers
RUN cd /tmp && \
    curl -fO https://musl.cc/arm-linux-musleabihf-cross.tgz && \
    ([ "$(sha256sum arm-linux-musleabihf-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_ARMV7_MUSL" ] || (echo "Mismatching checksums armv7"; exit 1)) && \
    tar xf arm-linux-musleabihf-cross.tgz && \
    rm arm-linux-musleabihf-cross.tgz && \
    curl -fO https://musl.cc/aarch64-linux-musl-cross.tgz && \
    ([ "$(sha256sum aarch64-linux-musl-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_ARMV8_MUSL" ] || (echo "Mismatching checksums armv8"; exit 1)) && \
    tar xf aarch64-linux-musl-cross.tgz && \
    rm aarch64-linux-musl-cross.tgz && \
    curl -fO https://musl.cc/x86_64-linux-musl-cross.tgz && \
    ([ "$(sha256sum x86_64-linux-musl-cross.tgz|cut -f1 -d ' ')" = "$CHKSUM_AMD64_MUSL" ] || (echo "Mismatching checksums amd64"; exit 1)) && \
    tar xf x86_64-linux-musl-cross.tgz && \
    rm x86_64-linux-musl-cross.tgz

RUN apt-get install -yq gcc libc-dev make && \
    gpg2 --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB && \
    curl -sSL https://get.rvm.io | bash -s stable && \
    /bin/bash -l -c "rvm requirements && rvm install 2.2 && gem install -N fpm"

COPY ./bootstrap.sh /tmp/bootstrap.sh
