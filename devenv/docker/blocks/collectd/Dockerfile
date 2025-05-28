FROM    ubuntu:xenial

ENV     DEBIAN_FRONTEND=noninteractive

RUN     apt-get -y update
RUN     apt-get -y install collectd curl python-pip

# add a fake mtab for host disk stats
ADD     etc_mtab /etc/mtab

ADD     collectd.conf.tpl /etc/collectd/collectd.conf.tpl

# First install pip with its hash
RUN     echo "pip==20.3.4 --hash=sha256:217ae5161a0e08c0fb873858806e3478c9775caffce5168b50ec885e358c199d" > /tmp/pip-requirements.txt && \
    pip install --require-hashes --no-cache-dir -r /tmp/pip-requirements.txt

# Then install the rest of the requirements
ADD     requirements.txt /tmp/requirements.txt
RUN     pip install --require-hashes --no-cache-dir -r /tmp/requirements.txt
ADD     start_container /usr/bin/start_container
RUN     chmod +x /usr/bin/start_container
CMD     start_container
