FROM centos:6.6

RUN yum install -y initscripts curl tar gcc libc6-dev git gcc-c++ openssl-devel
RUN yum install -y g++ make automake autoconf curl-devel zlib-devel httpd-devel apr-devel apr-util-devel sqlite-devel
RUN yum install -y wget yum-utils bzip2 bzip2-devel
RUN yum install -y fontconfig freetype freetype-devel fontconfig-devel libstdc++
RUN yum install -y rpm-build patch readline readline-devel libtool bison lzma

# Install RUBY 1.9.3
# install necessary utilities
RUN yum install -y which tar
RUN gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
#RUN curl -sSL https://get.rvm.io | bash -s stable
RUN curl -sSl https://raw.githubusercontent.com/rvm/rvm/master/binscripts/rvm-installer | bash -s stable
RUN source /etc/profile.d/rvm.sh
RUN /bin/bash -l -c "rvm requirements"
RUN /bin/bash -l -c "rvm install 2.1.9"
RUN /bin/bash -l -c "rvm use 2.1.9 --default"

# install nodejs
RUN curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -
RUN yum install -y nodejs --nogpgcheck

ENV GOLANG_VERSION 1.7.4

RUN wget https://storage.googleapis.com/golang/go1.7.4.linux-amd64.tar.gz
RUN tar -C /usr/local -xzf go1.7.4.linux-amd64.tar.gz

ENV PATH /usr/local/go/bin:$PATH

RUN mkdir -p /go/src /go/bin && chmod -R 777 /go

ENV GOPATH /go
ENV PATH /go/bin:$PATH

ADD ./scripts/build/build.sh /tmp/

WORKDIR /tmp/

CMD ["build.sh"]
