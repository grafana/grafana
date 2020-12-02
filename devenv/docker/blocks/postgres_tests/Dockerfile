ARG postgres_version=9.3
FROM postgres:${postgres_version}
ADD setup.sql /docker-entrypoint-initdb.d
CMD ["postgres"]
