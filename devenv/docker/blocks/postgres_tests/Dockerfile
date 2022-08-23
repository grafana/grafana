ARG postgres_version=9.5
FROM postgres:${postgres_version}
ADD setup.sql /docker-entrypoint-initdb.d
RUN chown -R postgres:postgres /docker-entrypoint-initdb.d/
CMD ["postgres"]
