from	ubuntu:14.10

run	apt-get -y update

run apt-get -y install software-properties-common

run	apt-get -y install python-software-properties &&\
	add-apt-repository ppa:chris-lea/node.js &&\
	apt-get -y update

run apt-get -y install  python-django-tagging python-simplejson python-memcache \
			    python-ldap python-cairo python-django python-twisted   \
			    python-pysqlite2 python-support python-pip gunicorn     \
			    supervisor nginx-light nodejs git wget curl

# Install statsd
run mkdir /src && git clone https://github.com/etsy/statsd.git /src/statsd

run cd /usr/local/src && git clone https://github.com/graphite-project/graphite-web.git
run cd /usr/local/src && git clone https://github.com/graphite-project/carbon.git
run cd /usr/local/src && git clone https://github.com/graphite-project/whisper.git

run cd /usr/local/src/whisper && git checkout master && python setup.py install
run cd /usr/local/src/carbon && git checkout 0.9.x && python setup.py install
run cd /usr/local/src/graphite-web && git checkout 0.9.x && python check-dependencies.py; python setup.py install

# statsd
add	./files/statsd_config.js /src/statsd/config.js

# Add graphite config
add	./files/initial_data.json /opt/graphite/webapp/graphite/initial_data.json
add	./files/local_settings.py /opt/graphite/webapp/graphite/local_settings.py
add	./files/carbon.conf /opt/graphite/conf/carbon.conf
add	./files/storage-schemas.conf /opt/graphite/conf/storage-schemas.conf
add	./files/storage-aggregation.conf /opt/graphite/conf/storage-aggregation.conf
add     ./files/events_views.py /opt/graphite/webapp/graphite/events/views.py

run	mkdir -p /opt/graphite/storage/whisper
run	touch /opt/graphite/storage/graphite.db /opt/graphite/storage/index
run	chown -R www-data /opt/graphite/storage
run	chmod 0775 /opt/graphite/storage /opt/graphite/storage/whisper
run	chmod 0664 /opt/graphite/storage/graphite.db
run	cd /opt/graphite/webapp/graphite && python manage.py syncdb --noinput

# Add system service config
add	./files/nginx.conf /etc/nginx/nginx.conf
add	./files/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# graphite
expose	80

# Carbon line receiver port
expose	2003
# Carbon cache query port
expose	7002

# Statsd UDP port
expose	8125/udp
# Statsd Management port
expose	8126

VOLUME ["/var/lib/elasticsearch"]
VOLUME ["/opt/graphite/storage/whisper"]
VOLUME ["/var/lib/log/supervisor"]

cmd	["/usr/bin/supervisord"]

# vim:ts=8:noet:
