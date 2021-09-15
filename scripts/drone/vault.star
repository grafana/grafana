pull_secret = 'dockerconfigjson'
github_token = 'github_token'
drone_token = 'drone_token'
tf_google_credentials = 'tf_google_credentials'

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
    ]
