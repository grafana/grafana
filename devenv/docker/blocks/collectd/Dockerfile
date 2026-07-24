FROM    ubuntu:jammy

ENV     DEBIAN_FRONTEND=noninteractive

RUN     apt-get -y update
RUN     apt-get -y install collectd curl python3-pip

# add a fake mtab for host disk stats
ADD     etc_mtab /etc/mtab

ADD     collectd.conf.tpl /etc/collectd/collectd.conf.tpl

# Install Python packages
ADD     requirements.txt /tmp/requirements.txt
RUN     pip3 install --require-hashes --no-cache-dir -r /tmp/requirements.txt

ADD     start_container /usr/bin/start_container
RUN     chmod +x /usr/bin/start_container
CMD     start_container
