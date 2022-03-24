load(
    'scripts/drone/steps/lib.star',
    'build_image',
)

def integration_test_services_volumes():
    return [
        { 'name': 'postgres', 'temp': { 'medium': 'memory' } },
        { 'name': 'mysql', 'temp': { 'medium': 'memory' }
    }]

def integration_test_services(edition):
    services = [
        {
            'name': 'postgres',
            'image': 'postgres:12.3-alpine',
            'environment': {
              'POSTGRES_USER': 'grafanatest',
              'POSTGRES_PASSWORD': 'grafanatest',
              'POSTGRES_DB': 'grafanatest',
              'PGDATA': '/var/lib/postgresql/data/pgdata',
            },
            'volumes': [{
                'name': 'postgres',
                'path': '/var/lib/postgresql/data/pgdata'
            }],
        },
        {
            'name': 'mysql',
            'image': 'mysql:5.6.48',
            'environment': {
                'MYSQL_ROOT_PASSWORD': 'rootpass',
                'MYSQL_DATABASE': 'grafana_tests',
                'MYSQL_USER': 'grafana',
                'MYSQL_PASSWORD': 'password',
            },
            'volumes': [{
                'name': 'mysql',
                'path': '/var/lib/mysql'
            }]
        },
    ]

    if edition in ('enterprise', 'enterprise2'):
        services.extend([{
            'name': 'redis',
            'image': 'redis:6.2.1-alpine',
            'environment': {},
        }, {
            'name': 'memcached',
            'image': 'memcached:1.6.9-alpine',
            'environment': {},
        }])

    return services

def ldap_service():
    return {
        'name': 'ldap',
        'image': 'osixia/openldap:1.4.0',
        'environment': {
          'LDAP_ADMIN_PASSWORD': 'grafana',
          'LDAP_DOMAIN': 'grafana.org',
          'SLAPD_ADDITIONAL_MODULES': 'memberof',
        },
    }

def intentapi_volumes():
    return [{
            'name': 'intentapi_certs',
            'temp': { 'medium': 'memory' },
    }]

def intentapi_services():
    intentapi_services = [
        {
            'name': 'etcd',
            'image': 'quay.io/coreos/etcd:v3.5.2',
            'detach': True,
            'commands': [
                '/usr/local/bin/etcd' +
                ' -name=etcd' +
                ' -listen-client-urls=http://0.0.0.0:2379' +
                ' -advertise-client-urls=http://0.0.0.0:2379' +
                ' -initial-advertise-peer-urls=http://0.0.0.0:2380' +
                ' -listen-peer-urls=http://0.0.0.0:2380' +
                ' -initial-cluster=etcd=http://0.0.0.0:2380'
            ],
        },
        {
            'name': 'apiserver',
            'pull': 'if-not-exists',
            'image': 'k8s.gcr.io/kube-apiserver:v1.23.3',
            'depends_on': [
                'etcd',
                'generate_intentapi_certs',
            ],
            'detach': True,
            'commands': [
                '/usr/local/bin/kube-apiserver' +
                ' --bind-address=0.0.0.0' +
                ' --secure-port=6443' +
                ' --etcd-servers=http://etcd:2379' +
                ' --client-ca-file=/drone/src/devenv/docker/blocks/intentapi/certs/ca.pem' +
                ' --tls-cert-file=/drone/src/devenv/docker/blocks/intentapi/certs/kubernetes.pem' +
                ' --tls-private-key-file=/drone/src/devenv/docker/blocks/intentapi/certs/kubernetes-key.pem' +
                ' --service-account-key-file=/drone/src/devenv/docker/blocks/intentapi/certs/service-account.pem' +
                ' --service-account-signing-key-file=/drone/src/devenv/docker/blocks/intentapi/certs/service-account-key.pem' +
                ' --service-account-issuer=https://0.0.0.0:6443'
            ],
            'volumes': [
                {
                    'name': 'intentapi_certs',
                    'path': '/drone/src/devenv/docker/blocks/intentapi/certs',
                },
            ],
        },
        {
            'name': 'wait-for-intentapi-services',
            'image': build_image,
            'depends_on': [
                'etcd',
                'apiserver',
            ],
            'commands': [
                'dockerize -wait http://etcd:2379 -timeout 120s',
                'dockerize -wait https://apiserver:6443 -timeout 120s',
            ],
            'volumes': [
                {
                    'name': 'intentapi_certs',
                    'path': '/drone/src/devenv/docker/blocks/intentapi/certs',
                },
            ],
        },
    ]
    return intentapi_services
