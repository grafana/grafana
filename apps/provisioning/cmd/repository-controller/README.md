# Repository Controller

This controller is responsible for watching repositories and:

<TODO: Fill out all it does>

## Local development

1. Run `make build` from within this folder
2. Run: provisioning api server, secrets service api server, unified storage, and auth.
3. Run: `./bin/repository-controller --token-exchange-url=http://localhost:6481/sign/access-token --token=ProvisioningAdminToken --provisioning-server-url=https://localhost:6446`
4. Create a repository and you'll see an add/update event observed