from  ubuntu:14.04

run apt-get -y update

run apt-get -y install libcairo2-dev libffi-dev pkg-config python-dev python-pip fontconfig apache2 libapache2-mod-wsgi git-core collectd memcached gcc g++ make supervisor nginx-light gunicorn

run cd /usr/local/src && git clone https://github.com/graphite-project/graphite-web.git
run cd /usr/local/src && git clone https://github.com/graphite-project/carbon.git
run cd /usr/local/src && git clone https://github.com/graphite-project/whisper.git

run pip install twisted==13.2.0 && pip install sphinx==1.5.2 && pip install cairocffi==0.9.0
run cd /usr/local/src/whisper && git checkout master && python setup.py install
run cd /usr/local/src/carbon && git checkout 0.9.x && pip install -r requirements.txt && python setup.py install
run cd /usr/local/src/graphite-web && git checkout 0.9.x && pip install -r requirements.txt && python check-dependencies.py && python setup.py install

# Add graphite config
add ./files/initial_data.json /opt/graphite/webapp/graphite/initial_data.json
add ./files/local_settings.py /opt/graphite/webapp/graphite/local_settings.py
add ./files/carbon.conf /opt/graphite/conf/carbon.conf
add ./files/storage-schemas.conf /opt/graphite/conf/storage-schemas.conf
add ./files/storage-aggregation.conf /opt/graphite/conf/storage-aggregation.conf
add ./files/events_views.py /opt/graphite/webapp/graphite/events/views.py

run mkdir -p /opt/graphite/storage/whisper
run touch /opt/graphite/storage/graphite.db /opt/graphite/storage/index
run chown -R www-data /opt/graphite/storage
run chmod 0775 /opt/graphite/storage /opt/graphite/storage/whisper
run chmod 0664 /opt/graphite/storage/graphite.db
run cd /opt/graphite/webapp/graphite && python manage.py syncdb --noinput

add ./files/my_htpasswd /etc/nginx/.htpasswd

# Add system service config
add ./files/nginx.conf /etc/nginx/nginx.conf
add ./files/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Nginx
#
# graphite
expose  80

# Carbon line receiver port
expose  2003

# Carbon cache query port
expose  7002

VOLUME ["/opt/graphite/storage/whisper"]
VOLUME ["/var/lib/log/supervisor"]

cmd ["/usr/bin/supervisord"]

# vim:ts=8:noet:
