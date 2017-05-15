FROM centos:6.6

RUN yum install -y initscripts curl tar gcc libc6-dev git sudo gcc-c++ make

ENV GOLANG_VERSION 1.4.2

RUN curl -sSL https://download.cloudwiz.cn/package/go$GOLANG_VERSION.src.tar.gz \
                | tar -v -C /usr/src -xz

RUN cd /usr/src/go/src && ./make.bash --no-clean 2>&1

ENV PATH /usr/src/go/bin:$PATH

RUN mkdir -p /go/src /go/bin && chmod -R 777 /go
ENV GOPATH /go
ENV PATH /go/bin:$PATH

WORKDIR /go/src/github.com/wangy1931/
RUN git clone https://github.com/wangy1931/grafana.git
WORKDIR /go/src/github.com/wangy1931/grafana

#install node
RUN curl -sL https://rpm.nodesource.com/setup_6.x | sudo -E bash -
RUN sudo yum install -y nodejs
RUN npm install -g cnpm --registry=https://registry.npm.taobao.org

#install grunt
RUN cnpm install ; exit 0
RUN cnpm install -g yarn
RUN yarn install --pure-lockfile; exit 0
RUN cnpm install -g grunt-cli