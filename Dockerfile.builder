FROM ubuntu:14.04 as toolchain

ENV OSX_SDK_URL=https://s3.dockerproject.org/darwin/v2/ \
    OSX_SDK=MacOSX10.11.sdk \
    OSX_MIN=10.6 \
    CTNG=1.23.0

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
RUN apt-get update   && \
    apt-get install -y  \
        clang-3.8 patch libxml2-dev \
        ca-certificates \
        curl            \
        git             \
        make            \
        xz-utils     && \
    git clone https://github.com/tpoechtrager/osxcross.git  /tmp/osxcross  && \
    curl -L ${OSX_SDK_URL}/${OSX_SDK}.tar.xz -o /tmp/osxcross/tarballs/${OSX_SDK}.tar.xz && \
    ln -s /usr/bin/clang-3.8 /usr/bin/clang              && \
    ln -s /usr/bin/clang++-3.8 /usr/bin/clang++          && \
    ln -s /usr/bin/llvm-dsymutil-3.8 /usr/bin/dsymutil   && \
    UNATTENDED=yes OSX_VERSION_MIN=${OSX_MIN} /tmp/osxcross/build.sh && \
    rm -rf /tmp/osxcross/target/SDK/${OSX_SDK}/usr/share && \
    cd /tmp                                              && \
    tar cfJ osxcross.tar.xz osxcross/target              && \
    rm -rf /tmp/osxcross                                 && \
    apt-get install -y                     \
        bison curl flex gawk gcc g++ gperf help2man libncurses5-dev make patch python-dev texinfo xz-utils && \
    curl -L http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-${CTNG}.tar.xz  \
         | tar -xJ -C /tmp/             && \
    cd /tmp/crosstool-ng-${CTNG}        && \
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
    tar cfJ x86_64-centos6-linux-gnu.tar.xz x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/x86_64-centos6-linux-gnu/ && \
    rm -rf /tmp/crosstool-ng-${CTNG}    && \
    apt-get install -y                           \
        ruby2.0 ruby2.0-dev gcc libc-dev make && \
    rm /usr/bin/ruby                          && \
    rm /usr/bin/gem                           && \
    ln -s /usr/bin/ruby2.0 /usr/bin/ruby      && \
    ln -s /usr/bin/gem2.0 /usr/bin/gem        && \
    gem install -N fpm                        && \
    gem install -N --install-dir /tmp/gems fpm  && \
    gem install -N --install-dir /tmp/gems json -v 1.8.6 && \
    mkdir -p /tmp/deb                         && \
    cd /tmp/deb                               && \
    find /tmp/gems/cache -name '*.gem'           \
       | xargs -rn1 fpm -d ruby --prefix $(gem environment gemdir) -s gem -t deb

# base image to crossbuild grafana
FROM ubuntu:14.04

ENV GOVERSION=1.10 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=6.13.0

COPY --from=toolchain /tmp/x86_64-centos6-linux-gnu.tar.xz /tmp/
COPY --from=toolchain /tmp/osxcross.tar.xz /tmp/
COPY --from=toolchain /tmp/deb/*.deb /tmp/

RUN apt-get update   && \
    apt-get install -y  \
        clang-3.8 gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf gcc-mingw-w64-x86-64 \
        apt-transport-https \
        ca-certificates \
        curl            \
        libfontconfig1  \
        gcc             \
        g++             \
        git             \
        make            \
        rpm             \
        ruby2.0         \
        xz-utils     && \
    rm /usr/bin/ruby  &&  ln -s /usr/bin/ruby2.0 /usr/bin/ruby          && \
    ln -s /usr/bin/clang-3.8 /usr/bin/clang                             && \
    ln -s /usr/bin/clang++-3.8 /usr/bin/clang++                         && \
    ln -s /usr/bin/llvm-dsymutil-3.8 /usr/bin/dsymutil                  && \
    curl -L https://nodejs.org/dist/v${NODEVERSION}/node-v${NODEVERSION}-linux-x64.tar.xz \
      | tar -xJ --strip-components=1 -C /usr/local                      && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -   && \
    echo "deb [arch=amd64] https://dl.yarnpkg.com/debian/ stable main"     \
      | tee /etc/apt/sources.list.d/yarn.list                           && \
    apt-get update && apt-get install --no-install-recommends yarn      && \
    curl -L https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz \
      | tar -xz -C /usr/local
