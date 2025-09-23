## MySQL with Open Data Set from NYC Open Data (https://data.cityofnewyork.us)

FROM mysql:latest

ENV MYSQL_DATABASE="testdata" \
    MYSQL_ROOT_PASSWORD="rootpass" \
    MYSQL_USER="grafana" \
    MYSQL_PASSWORD="password"

# Install requirement (wget)
RUN apt-get update && apt-get install -y wget && apt-get install unzip

# Fetch NYC Data Set
RUN wget https://data.cityofnewyork.us/download/57g5-etyj/application%2Fzip -O /tmp/data.zip && \
  unzip -j /tmp/data.zip 311_Service_Requests_from_2015.csv -d /var/lib/mysql-files && \
  rm /tmp/data.zip

ADD import_csv.sql /docker-entrypoint-initdb.d/

EXPOSE 3306
