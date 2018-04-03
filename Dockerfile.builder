FROM ubuntu:14.04

ENV GOVERSION=1.10 \
    PATH=/usr/local/go/bin:$PATH \
    GOPATH=/go \
    NODEVERSION=6.13.0 \
    OSX_SDK_URL=https://s3.dockerproject.org/darwin/v2/ \
    OSX_SDK=MacOSX10.11.sdk.tar.xz

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







