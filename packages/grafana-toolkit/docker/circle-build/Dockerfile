FROM circleci/node:12
RUN mkdir -pv /home/circleci/tmp
WORKDIR /home/circleci/tmp

# Install Go
RUN curl -fLO https://dl.google.com/go/go1.14.linux-amd64.tar.gz
RUN echo 08df79b46b0adf498ea9f320a0f23d6ec59e9003660b4c9c1ce8e5e2c6f823ca go1.14.linux-amd64.tar.gz | sha256sum --check --status
RUN sudo tar -C /usr/local -xf go1.14.linux-amd64.tar.gz

# Install golangci-lint
RUN curl -fLO https://github.com/golangci/golangci-lint/releases/download/v1.23.7/golangci-lint-1.23.7-linux-amd64.tar.gz
RUN echo 34df1794a2ea8e168b3c98eed3cc0f3e13ed4cba735e4e40ef141df5c41bc086 golangci-lint-1.23.7-linux-amd64.tar.gz | sha256sum --check --status
RUN tar xf golangci-lint-1.23.7-linux-amd64.tar.gz
RUN sudo mv golangci-lint-1.23.7-linux-amd64/golangci-lint /usr/local/bin
RUN sudo ln -s /usr/local/go/bin/go /usr/local/bin/go
RUN sudo ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt

# Install Mage
RUN mkdir -pv ~/go/bin
RUN mkdir -pv ~/bin
RUN git clone https://github.com/magefile/mage.git /home/circleci/tmp/mage
RUN cd /home/circleci/tmp/mage && go run bootstrap.go
RUN sudo ln -s /home/circlci/go/bin/mage /home/circleci/bin/mage

COPY --chown=3434:3434 bashrc /home/circleci/.bashrc
