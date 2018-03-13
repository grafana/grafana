FROM microsoft/mssql-server-linux:latest
WORKDIR /usr/setup
COPY . /usr/setup
RUN chmod +x /usr/setup/setup.sh
CMD /bin/bash ./entrypoint.sh