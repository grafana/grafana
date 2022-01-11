FROM mcr.microsoft.com/azure-sql-edge:latest
WORKDIR /usr/setup
COPY entrypoint.sh ./

USER root

RUN chown -R mssql ./

USER mssql

CMD /bin/bash ./entrypoint.sh
