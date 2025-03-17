## Configuration

To run the IAM API server, you'll need to set up your configuration:

1. Copy the template files:
   ```bash
   cp custom.ini.template custom.ini
   cp .env.example .env
   ```

2. Update the `.env` file with your actual configuration values:
   - Replace placeholder values with your actual database credentials
   - Update paths to your key and certificate files
   - Set your actual signing keys URL

3. Run the server:
   ```bash
   ./bin/grafana server --config=custom.ini
   ```

Full setup for certificate generations

```bash
openssl ecparam -genkey -name prime256v1 -out PATH_TO/authz.key
openssl req -new -key PATH_TO/authz.key -out PATH_TO/authz.csr -config PATH_TO/openssl.cnf
openssl x509 -req -days 365 -in PATH_TO/authz.csr -signkey PATH_TO/authz.key -out PATH_TO/authz.crt -extensions v3_req -extfile PATH_TO/openssl.cnf
```