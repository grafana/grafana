FROM grafana/wix-toolset-ci:v3

RUN mkdir -p /tmp/dist /tmp/cache && \
    cd /tmp/dist && \
    wget https://dl.grafana.com/enterprise/main/grafana-enterprise-6.6.0-ca61af52pre.windows-amd64.zip && \
    unzip -l *.zip

COPY . /package-grafana
WORKDIR /package-grafana

RUN cp ./msigenerator/cache/nssm-2.24.zip /tmp/cache

RUN cd msigenerator && python3 generator/build.py
