FROM    ubuntu:xenial

ENV     DEBIAN_FRONTEND=noninteractive

RUN     apt-get -y update
RUN     apt-get -y install collectd curl python-pip

# add a fake mtab for host disk stats
ADD     etc_mtab /etc/mtab

ADD     collectd.conf.tpl /etc/collectd/collectd.conf.tpl

RUN	pip install --no-cache-dir envtpl
ADD     start_container /usr/bin/start_container
RUN     chmod +x /usr/bin/start_container
CMD     start_container
