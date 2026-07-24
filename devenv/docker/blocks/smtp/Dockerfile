FROM centos:centos7
LABEL maintainer="Przemyslaw Ozgo <linux@ozgo.info>"

RUN \
    yum update -y && \
    yum install -y net-snmp net-snmp-utils && \
    yum clean all

COPY bootstrap.sh /tmp/bootstrap.sh

EXPOSE 161

ENTRYPOINT ["/tmp/bootstrap.sh"]
