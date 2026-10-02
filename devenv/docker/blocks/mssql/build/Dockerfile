FROM mcr.microsoft.com/mssql/server:2019-CU8-ubuntu-18.04
WORKDIR /usr/setup
COPY setup.sh setup.sql.template entrypoint.sh ./

USER root

RUN chmod +x setup.sh
RUN chown -R mssql ./

USER mssql

CMD /bin/bash ./entrypoint.sh
