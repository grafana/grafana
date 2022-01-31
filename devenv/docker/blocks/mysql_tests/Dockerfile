ARG mysql_version=5.6
FROM mysql:${mysql_version}
ADD setup.sql /docker-entrypoint-initdb.d
RUN chown -R mysql:mysql /docker-entrypoint-initdb.d/
CMD ["mysqld"]
