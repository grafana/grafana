FROM mcr.microsoft.com/mssql/server:2017-CU4-ubuntu
WORKDIR /usr/setup
COPY . /usr/setup
RUN chmod +x /usr/setup/setup.sh
CMD /bin/bash ./entrypoint.sh