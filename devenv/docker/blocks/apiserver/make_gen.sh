cd /tmp
go install github.com/cloudflare/cfssl/cmd/...@latest
rm -rf certs final
cfssl genkey -initca csr.json | cfssljson -bare ca
mkdir -p certs final
mv ca* certs/
cfssl gencert -ca certs/ca.pem -ca-key certs/ca-key.pem -hostname=host.docker.internal csr.json | cfssljson -bare out
mv out* final/

echo 'PUT THIS IN VALIDATING WEBHOOK CONFIGURATION'
echo 'clientConfig'
echo '  caBundle: {BASE64}'
cat certs/ca.pem | base64
