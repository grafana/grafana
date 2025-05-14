FROM emqx/nanomq:0.21.11-full

RUN apt-get update && apt-get install -y \
  openssl \
  && rm -rf /var/lib/apt/lists/*

COPY ./san.cnf /etc/certs/san.cnf
COPY ./gen_certs.sh /etc/certs/gen_certs.sh
RUN /etc/certs/gen_certs.sh
