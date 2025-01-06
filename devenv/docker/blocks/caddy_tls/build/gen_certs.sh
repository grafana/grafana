#!/bin/sh

DAYS_VALID=3650

# Create CA certificate
openssl genpkey -algorithm RSA -out ca.key
openssl req -new -x509 -days $DAYS_VALID -key ca.key -out ca.pem -subj "/CN=My CA"

# Create server certificate
openssl genpkey -algorithm RSA -out server.key
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"
openssl x509 -req -days $DAYS_VALID -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out server.pem -extfile san.cnf -extensions v3_req

# Create client key and certificate
openssl genpkey -algorithm RSA -out client.key
openssl req -new -key client.key -out client.csr -subj "/CN=Client"
openssl x509 -req -days $DAYS_VALID -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out client.pem -extfile san.cnf -extensions v3_req
