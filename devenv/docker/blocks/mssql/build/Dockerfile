FROM microsoft/mssql-server-linux:2017-CU4
WORKDIR /usr/setup
COPY . /usr/setup
RUN chmod +x /usr/setup/setup.sh
CMD /bin/bash ./entrypoint.sh