FROM circleci/node:12-browsers
USER root 
WORKDIR /tmp

# Install Go
ADD https://dl.google.com/go/go1.14.linux-amd64.tar.gz /tmp
RUN echo 08df79b46b0adf498ea9f320a0f23d6ec59e9003660b4c9c1ce8e5e2c6f823ca go1.14.linux-amd64.tar.gz | sha256sum --check --status
RUN tar -C /usr/local -xf go1.14.linux-amd64.tar.gz

# Install golangci-lint
ADD https://github.com/golangci/golangci-lint/releases/download/v1.23.7/golangci-lint-1.23.7-linux-amd64.tar.gz /tmp
RUN echo 34df1794a2ea8e168b3c98eed3cc0f3e13ed4cba735e4e40ef141df5c41bc086 golangci-lint-1.23.7-linux-amd64.tar.gz | sha256sum --check --status
RUN tar xf golangci-lint-1.23.7-linux-amd64.tar.gz
RUN mv golangci-lint-1.23.7-linux-amd64/golangci-lint /usr/local/bin
RUN ln -s /usr/local/go/bin/go /usr/local/bin/go
RUN ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
RUN chmod 755 /usr/local/bin/golangci-lint

# Install dependencies
RUN apt-get update -y && apt-get install -y adduser libfontconfig1 locate && /bin/rm -rf /var/lib/apt/lists/*

# Install code climate
ADD https://codeclimate.com/downloads/test-reporter/test-reporter-latest-linux-amd64 /usr/local/bin/cc-test-reporter
RUN echo 38f2442892027f61a07f52c845818750261b2ba58bffb043a582495339d37c05 /usr/local/bin/cc-test-reporter | sha256sum --check --status
RUN chmod +x /usr/local/bin/cc-test-reporter

# Download, but don't install previous grafana releases
RUN mkdir -pv /usr/local/grafana/deb
ADD https://dl.grafana.com/oss/release/grafana_6.6.2_amd64.deb /usr/local/grafana/deb
ADD https://dl.grafana.com/oss/release/grafana_6.5.3_amd64.deb /usr/local/grafana/deb
ADD https://dl.grafana.com/oss/release/grafana_6.4.5_amd64.deb /usr/local/grafana/deb
ADD https://dl.grafana.com/oss/release/grafana_6.3.7_amd64.deb /usr/local/grafana/deb

# Perform user specific initialization
USER circleci
RUN mkdir -pv ${HOME}/plugin ${HOME}/go/bin ${HOME}/bin ${HOME}/src ${HOME}/tmp

# Install grafana release with yarn
RUN git clone https://github.com/grafana/grafana.git ${HOME}/src/grafana
WORKDIR /home/circleci/src/grafana
RUN git checkout tags/v$(curl -s https://raw.githubusercontent.com/grafana/grafana/master/latest.json | jq -r '.stable')
RUN yarn cache clean && yarn install --frozen-lockfile

# Install Mage
RUN git clone https://github.com/magefile/mage.git ${HOME}/src/mage 
WORKDIR /home/circleci/src/mage
RUN go run bootstrap.go

ENV PATH /home/circleci/go/bin:/usr/local/go/bin:/home/circleci/.local/bin:/home/circleci/bin:${PATH}
WORKDIR /home/circleci/plugin

