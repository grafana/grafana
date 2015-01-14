FROM phusion/baseimage:0.9.8
MAINTAINER Nick Stenning <nick@whiteink.com>

ENV HOME /root

# Disable SSH
RUN rm -rf /etc/service/sshd /etc/my_init.d/00_regen_ssh_host_keys.sh

# Use baseimage-docker's init system.
CMD ["/sbin/my_init"]

# Configure apt
RUN echo 'deb http://us.archive.ubuntu.com/ubuntu/ precise universe' >> /etc/apt/sources.list
RUN apt-get -y update

# Install slapd
RUN LC_ALL=C DEBIAN_FRONTEND=noninteractive apt-get install -y slapd

# Default configuration: can be overridden at the docker command line
ENV LDAP_ROOTPASS toor
ENV LDAP_ORG Acme Widgets Inc.
ENV LDAP_DOMAIN example.com

EXPOSE 389

RUN mkdir /etc/service/slapd
ADD slapd.sh /etc/service/slapd/run

# To store the data outside the container, mount /var/lib/ldap as a data volume

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# vim:ts=8:noet:
