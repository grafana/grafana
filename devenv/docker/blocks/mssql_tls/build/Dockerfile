FROM mcr.microsoft.com/mssql/server:2019-CU8-ubuntu-18.04

WORKDIR /usr/setup
COPY setup.sh setup.sql.template entrypoint.sh ./
COPY mssql.conf /var/opt/mssql/mssql.conf

USER root

RUN chmod +x setup.sh
RUN chown -R mssql ./
RUN mkdir -p /home/mssql
RUN chown -R mssql /home/mssql

USER mssql

RUN touch ~/.rnd
RUN openssl req -x509 -nodes -newkey rsa:2048 -subj '/CN=mssql_tls' -keyout /var/opt/mssql/mssql.key -out /var/opt/mssql/mssql.pem -days 365
RUN chmod 440 /var/opt/mssql/mssql.key
RUN chmod 440 /var/opt/mssql/mssql.pem

CMD /bin/bash ./entrypoint.sh
