pull_secret = 'dockerconfigjson'
github_token = 'github_token'
drone_token = 'drone_token'
prerelease_bucket = 'prerelease_bucket'
gcp_upload_artifacts_key = 'gcp_upload_artifacts_key'

def from_secret(secret):
    return {
        'from_secret': secret
    }

def vault_secret(name, path, key):
    return {
        'kind': 'secret',
        'name': name,
        'get': {
            'path': path,
            'name': key,
        }
    }

def secrets():
    return [
        vault_secret(pull_secret, 'secret/data/common/gcr', '.dockerconfigjson'),
        vault_secret(github_token, 'infra/data/ci/github/grafanabot', 'pat'),
        vault_secret(drone_token, 'infra/data/ci/drone', 'machine-user-token'),
        vault_secret(prerelease_bucket, 'infra/data/ci/grafana/prerelease', 'bucket'),
        vault_secret(gcp_upload_artifacts_key, 'infra/data/ci/grafana/releng/artifacts-uploader-service-account', 'credentials.json'),
    
        # Package publishing
        vault_secret('packages_gpg_public_key', 'infra/data/ci/packages-publish/gpg', 'public-key'),
        vault_secret('packages_gpg_private_key', 'infra/data/ci/packages-publish/gpg', 'private-key'),
        vault_secret('packages_gpg_passphrase', 'infra/data/ci/packages-publish/gpg', 'passphrase'),
        vault_secret('packages_service_account', 'infra/data/ci/packages-publish/service-account', 'credentials.json'),
        vault_secret('packages_access_key_id', 'infra/data/ci/packages-publish/bucket-credentials', 'AccessID'),
        vault_secret('packages_secret_access_key', 'infra/data/ci/packages-publish/bucket-credentials', 'Secret'),
    ]
