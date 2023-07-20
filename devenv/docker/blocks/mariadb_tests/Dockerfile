ARG mariadb_version=10.11
FROM mariadb:${mariadb_version}
COPY setup.sql /docker-entrypoint-initdb.d
CMD ["mariadbd"]
