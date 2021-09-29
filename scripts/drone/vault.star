pull_secret = 'dockerconfigjson'
github_token = 'github_token'
drone_token = 'drone_token'
tf_google_credentials = 'tf_google_credentials'
access_key = 'access_key'
secret = 'secret'

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
        vault_secret(tf_google_credentials, 'infra/data/ci/terraform/google', 'credentials.json'),
        vault_secret(access_key, 'infra/data/ci/test-drone-caching', 'access-key'),
        vault_secret(secret, 'infra/data/ci/test-drone-caching', 'secret'),
    ]
