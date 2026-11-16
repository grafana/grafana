#!/usr/bin/env bash
# Generates the certificates for the ha-test-nats setup into certs/out:
#   out/ca.crt                          CA that signs every node certificate
#   out/grafanaN/{node.crt,node.key,ca.crt}  one directory per Grafana node, mounted at /certs
#   out/rogue/{node.crt,node.key}       a certificate for grafana1 signed by a second, untrusted CA
#
# Node certificates carry both serverAuth and clientAuth because every instance
# accepts and dials cluster routes. Their only SAN is the node hostname, which is
# what each instance advertises to its peers.
set -euo pipefail

cd "$(dirname "$0")"

nodes=${NATS_NODES:-3}
days=${CERT_DAYS:-30}
out=out

rm -rf "$out"
mkdir -p "$out/rogue"

new_ca() {
	local dir=$1 cn=$2
	openssl req -x509 -newkey rsa:2048 -nodes -days "$days" -sha256 \
		-subj "/CN=$cn" -keyout "$dir/ca.key" -out "$dir/ca.crt" 2>/dev/null
}

# new_cert <ca dir> <out dir> <cn> <san>
new_cert() {
	local ca=$1 dir=$2 cn=$3 san=$4
	openssl req -newkey rsa:2048 -nodes -sha256 -subj "/CN=$cn" \
		-keyout "$dir/node.key" -out "$dir/node.csr" 2>/dev/null
	printf 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth,clientAuth\nsubjectAltName=%s\n' "$san" >"$dir/node.ext"
	openssl x509 -req -in "$dir/node.csr" -CA "$ca/ca.crt" -CAkey "$ca/ca.key" -CAcreateserial \
		-days "$days" -sha256 -extfile "$dir/node.ext" -out "$dir/node.crt" 2>/dev/null
	rm -f "$dir/node.csr" "$dir/node.ext"
	# Grafana runs as uid 472 in the container and must read the bind-mounted key.
	# These are throwaway test keys.
	chmod 0644 "$dir/node.key"
}

new_ca "$out" "ha-test-nats CA"
for i in $(seq 1 "$nodes"); do
	dir="$out/grafana$i"
	mkdir -p "$dir"
	new_cert "$out" "$dir" "grafana$i" "DNS:grafana$i"
	cp "$out/ca.crt" "$dir/ca.crt"
done

mkdir -p "$out/rogue-ca"
new_ca "$out/rogue-ca" "ha-test-nats rogue CA"
new_cert "$out/rogue-ca" "$out/rogue" "grafana1" "DNS:grafana1"

rm -f "$out/ca.srl" "$out/rogue-ca/ca.srl"
echo "certificates written to $(pwd)/$out"
