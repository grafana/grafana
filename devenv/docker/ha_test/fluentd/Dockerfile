FROM fluent/fluentd:v1.3.3-debian-1.0

# USER root

# RUN apk add --no-cache --update --virtual .build-deps \
#         sudo build-base ruby-dev \
#  && sudo gem install bundler \
#  && gem 'loki', git: 'https://github.com/grafana/loki.git', glob: 'fluentd/fluent-plugin-loki/*.gemspec' \
#  && sudo gem sources --clear-all \
#  && apk del .build-deps \
#  && rm -rf /home/fluent/.gem/ruby/2.5.0/cache/*.gem

# USER fluent

USER root

COPY Gemfile .
RUN ["gem", "install", "fluent-plugin-loki"]

# RUN apt-get -y update \
#  && apt-get -y install git \
#  && apt-get clean \
#  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/man/?? /usr/share/man/??_*

# RUN gem install bundler \
#  && bundler install

# COPY fluent.conf /fluentd/etc

USER fluent
