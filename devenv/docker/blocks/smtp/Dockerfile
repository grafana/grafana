FROM centos:centos7
LABEL maintainer="Przemyslaw Ozgo <linux@ozgo.info>"

RUN \
    yum update -y && \
    yum install -y net-snmp net-snmp-utils && \
    yum clean all

COPY bootstrap.sh /tmp/bootstrap.sh

RUN useradd -r -s /sbin/nologin snmpuser && \
    chown snmpuser:snmpuser /tmp/bootstrap.sh && \
    chmod 550 /tmp/bootstrap.sh

EXPOSE 161

USER snmpuser

ENTRYPOINT ["/tmp/bootstrap.sh"]
