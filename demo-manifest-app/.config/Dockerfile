ARG grafana_version=latest
ARG grafana_image=grafana-enterprise

FROM grafana/${grafana_image}:${grafana_version}

ARG anonymous_auth_enabled=true
ARG development=false
ARG TARGETARCH

ARG GO_VERSION=1.21.6
ARG GO_ARCH=${TARGETARCH:-amd64}

ENV DEV "${development}"

# Make it as simple as possible to access the grafana instance for development purposes
# Do NOT enable these settings in a public facing / production grafana instance
ENV GF_AUTH_ANONYMOUS_ORG_ROLE "Admin"
ENV GF_AUTH_ANONYMOUS_ENABLED "${anonymous_auth_enabled}"
ENV GF_AUTH_BASIC_ENABLED "false"
# Set development mode so plugins can be loaded without the need to sign
ENV GF_DEFAULT_APP_MODE "development"


LABEL maintainer="Grafana Labs <hello@grafana.com>"

ENV GF_PATHS_HOME="/usr/share/grafana"
WORKDIR $GF_PATHS_HOME

USER root

# Installing supervisor and inotify-tools
RUN if [ "${development}" = "true" ]; then \
    if grep -i -q alpine /etc/issue; then \
    apk add supervisor inotify-tools git; \
    elif grep -i -q ubuntu /etc/issue; then \
    DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y supervisor inotify-tools git && \
    rm -rf /var/lib/apt/lists/*; \
    else \
    echo 'ERROR: Unsupported base image' && /bin/false; \
    fi \
    fi

COPY supervisord/supervisord.conf /etc/supervisor.d/supervisord.ini
COPY supervisord/supervisord.conf /etc/supervisor/conf.d/supervisord.conf


# Installing Go
RUN if [ "${development}" = "true" ]; then \
    curl -O -L https://golang.org/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf go${GO_VERSION}.linux-${GO_ARCH}.tar.gz && \
    echo "export PATH=$PATH:/usr/local/go/bin:~/go/bin" >> ~/.bashrc && \
    rm -f go${GO_VERSION}.linux-${GO_ARCH}.tar.gz; \
    fi

# Installing delve for debugging
RUN if [ "${development}" = "true" ]; then \
    /usr/local/go/bin/go install github.com/go-delve/delve/cmd/dlv@latest; \
    fi

# Installing mage for plugin (re)building
RUN if [ "${development}" = "true" ]; then \
    git clone https://github.com/magefile/mage; \
    cd mage; \
    export PATH=$PATH:/usr/local/go/bin; \
    go run bootstrap.go; \
    fi

# Inject livereload script into grafana index.html
RUN sed -i 's|</body>|<script src="http://localhost:35729/livereload.js"></script></body>|g' /usr/share/grafana/public/views/index.html


COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
