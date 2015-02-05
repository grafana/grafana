#!/bin/sh
#
# Creates the CA, server and client certs to be used by tls_test.go
# http://www.rabbitmq.com/ssl.html
#
# Copy stdout into the const section of tls_test.go or use for RabbitMQ
#
root=$PWD/certs

if [ -f $root/ca/serial ]; then
  echo >&2 "Previous installation found"
  echo >&2 "Remove $root/ca and rerun to overwrite"
  exit 1
fi

mkdir -p $root/ca/private
mkdir -p $root/ca/certs
mkdir -p $root/server
mkdir -p $root/client

cd $root/ca

chmod 700 private
touch index.txt
echo 'unique_subject = no' > index.txt.attr
echo '01' > serial
echo >openssl.cnf '
[ ca ]
default_ca = testca

[ testca ]
dir = .
certificate = $dir/cacert.pem
database = $dir/index.txt
new_certs_dir = $dir/certs
private_key = $dir/private/cakey.pem
serial = $dir/serial

default_crl_days = 7
default_days = 3650
default_md = sha1

policy = testca_policy
x509_extensions = certificate_extensions

[ testca_policy ]
commonName = supplied
stateOrProvinceName = optional
countryName = optional
emailAddress = optional
organizationName = optional
organizationalUnitName = optional

[ certificate_extensions ]
basicConstraints = CA:false

[ req ]
default_bits = 2048
default_keyfile = ./private/cakey.pem
default_md = sha1
prompt = yes
distinguished_name = root_ca_distinguished_name
x509_extensions = root_ca_extensions

[ root_ca_distinguished_name ]
commonName = hostname

[ root_ca_extensions ]
basicConstraints = CA:true
keyUsage = keyCertSign, cRLSign

[ client_ca_extensions ]
basicConstraints = CA:false
keyUsage = digitalSignature
extendedKeyUsage = 1.3.6.1.5.5.7.3.2

[ server_ca_extensions ]
basicConstraints = CA:false
keyUsage = keyEncipherment
extendedKeyUsage = 1.3.6.1.5.5.7.3.1
subjectAltName = @alt_names

[ alt_names ]
IP.1 = 127.0.0.1
'

openssl req \
  -x509 \
  -nodes \
  -config openssl.cnf \
  -newkey rsa:2048 \
  -days 3650 \
  -subj "/CN=MyTestCA/" \
  -out cacert.pem \
  -outform PEM

openssl x509 \
  -in cacert.pem \
  -out cacert.cer \
  -outform DER

openssl genrsa -out $root/server/key.pem 2048
openssl genrsa -out $root/client/key.pem 2048

openssl req \
  -new \
  -nodes \
  -config openssl.cnf \
  -subj "/CN=127.0.0.1/O=server/" \
  -key $root/server/key.pem \
  -out $root/server/req.pem \
  -outform PEM

openssl req \
  -new \
  -nodes \
  -config openssl.cnf \
  -subj "/CN=127.0.0.1/O=client/" \
  -key $root/client/key.pem \
  -out $root/client/req.pem \
  -outform PEM

openssl ca \
  -config openssl.cnf \
  -in $root/server/req.pem \
  -out $root/server/cert.pem \
  -notext \
  -batch \
  -extensions server_ca_extensions

openssl ca \
  -config openssl.cnf \
  -in $root/client/req.pem \
  -out $root/client/cert.pem \
  -notext \
  -batch \
  -extensions client_ca_extensions

cat <<-END
const caCert = \`
`cat $root/ca/cacert.pem`
\`

const serverCert = \`
`cat $root/server/cert.pem`
\`

const serverKey = \`
`cat $root/server/key.pem`
\`

const clientCert = \`
`cat $root/client/cert.pem`
\`

const clientKey = \`
`cat $root/client/key.pem`
\`
END
