#!/bin/bash

DAYS_VALID=3650
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create CA certificate
openssl genpkey -algorithm RSA -out "$SCRIPT_DIR/ca.key"
openssl req -new -x509 -days $DAYS_VALID -key "$SCRIPT_DIR/ca.key" -out "$SCRIPT_DIR/ca.pem" -subj "/CN=My CA"

# Create server certificate
openssl genpkey -algorithm RSA -out "$SCRIPT_DIR/server.key"
openssl req -new -key "$SCRIPT_DIR/server.key" -out "$SCRIPT_DIR/server.csr" -subj "/CN=localhost"
openssl x509 -req -days $DAYS_VALID -in "$SCRIPT_DIR/server.csr" -CA "$SCRIPT_DIR/ca.pem" -CAkey "$SCRIPT_DIR/ca.key" -CAcreateserial -out "$SCRIPT_DIR/server.pem" -extfile "$SCRIPT_DIR/san.cnf" -extensions v3_req

# Create client key and certificate
openssl genpkey -algorithm RSA -out "$SCRIPT_DIR/client.key"
openssl req -new -key "$SCRIPT_DIR/client.key" -out "$SCRIPT_DIR/client.csr" -subj "/CN=Client"
openssl x509 -req -days $DAYS_VALID -in "$SCRIPT_DIR/client.csr" -CA "$SCRIPT_DIR/ca.pem" -CAkey "$SCRIPT_DIR/ca.key" -CAcreateserial -out "$SCRIPT_DIR/client.pem" -extfile "$SCRIPT_DIR/san.cnf" -extensions v3_req
