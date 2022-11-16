######################## IMPORTANT ########################
#
# There are 2 Dockerfiles which must be kept in sync:
#
# - Dockerfile
# - packaging/docker/Dockerfile
#
###########################################################

ARG BASE_IMAGE=alpine:3.15

FROM ${BASE_IMAGE} as grafana-builder

WORKDIR /tmp/grafana

ARG GRAFANA_TGZ="grafana-latest.linux-x64-musl.tar.gz"

# Make sure we have Gnu tar
RUN if grep -i -q alpine /etc/issue; then \
      apk add --no-cache tar; \
    fi

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# Change to tar xfzv to make tar print every file it extracts
RUN tar xzf /tmp/grafana.tar.gz --strip-components=1 -C /tmp/grafana

# Final stage
FROM ${BASE_IMAGE}

LABEL maintainer="Grafana Labs <hello@grafana.com>"

ARG GF_UID="472"
ARG GF_GID="0"

ENV PATH="/usr/share/grafana/bin:$PATH" \
    GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
    GF_PATHS_DATA="/var/lib/grafana" \
    GF_PATHS_HOME="/usr/share/grafana" \
    GF_PATHS_LOGS="/var/log/grafana" \
    GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
    GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

# Install dependencies
RUN if grep -i -q alpine /etc/issue; then \
      apk add --no-cache ca-certificates bash tzdata musl-utils && \
      apk info -vv | sort; \
    elif grep -i -q ubuntu /etc/issue; then \
      DEBIAN_FRONTEND=noninteractive && \
      apt-get update && \
      apt-get install -y ca-certificates curl tzdata && \
      apt-get autoremove -y && \
      rm -rf /var/lib/apt/lists/*; \
    else \
      echo 'ERROR: Unsupported base image' && /bin/false; \
    fi

# Oracle Support for x86_64 only
RUN if grep -i -q alpine /etc/issue && [ `arch` = "x86_64" ]; then \
      wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.35-r0/glibc-2.35-r0.apk \
        -O /tmp/glibc-2.35-r0.apk && \
      wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.35-r0/glibc-bin-2.35-r0.apk \
        -O /tmp/glibc-bin-2.35-r0.apk && \
      apk add --no-cache --allow-untrusted /tmp/glibc-2.35-r0.apk /tmp/glibc-bin-2.35-r0.apk && \
      rm -f /lib64/ld-linux-x86-64.so.2 && \
      ln -s /usr/glibc-compat/lib64/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2 && \
      rm -f /tmp/glibc-2.35-r0.apk && \
      rm -f /tmp/glibc-bin-2.35-r0.apk && \
      rm -f /lib/ld-linux-x86-64.so.2 && \
      rm -f /etc/ld.so.cache; \
    fi

COPY --from=grafana-builder /tmp/grafana/conf ./conf

RUN if [ ! $(getent group "$GF_GID") ]; then \
      if grep -i -q alpine /etc/issue; then \
        addgroup -S -g $GF_GID grafana; \
      else \
        addgroup --system --gid $GF_GID grafana; \
      fi; \
    fi && \
    GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
    mkdir -p "$GF_PATHS_HOME/.aws" && \
    if grep -i -q alpine /etc/issue; then \
      adduser -S -u $GF_UID -G "$GF_GID_NAME" grafana; \
    else \
      adduser --system --uid $GF_UID --ingroup "$GF_GID_NAME" grafana; \
    fi && \
    mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
             "$GF_PATHS_PROVISIONING/dashboards" \
             "$GF_PATHS_PROVISIONING/notifiers" \
             "$GF_PATHS_PROVISIONING/plugins" \
             "$GF_PATHS_PROVISIONING/access-control" \
             "$GF_PATHS_PROVISIONING/alerting" \
             "$GF_PATHS_LOGS" \
             "$GF_PATHS_PLUGINS" \
             "$GF_PATHS_DATA" && \
    cp conf/sample.ini "$GF_PATHS_CONFIG" && \
    cp conf/ldap.toml /etc/grafana/ldap.toml && \
    chown -R "grafana:$GF_GID_NAME" "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
    chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

COPY --from=grafana-builder /tmp/grafana/bin/grafana-server /tmp/grafana/bin/grafana-cli ./bin/
COPY --from=grafana-builder /tmp/grafana/public ./public

EXPOSE 3000

COPY ./run.sh /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]
