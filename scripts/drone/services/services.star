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
            'commands': [
                '/usr/local/bin/etcd' +
                ' -name=etcd-node-0' +
                ' -listen-client-urls=http://etcd:2379' +
                ' -advertise-client-urls=http://etcd:2379' +
                ' -initial-advertise-peer-urls=http://etcd:2380' +
                ' -listen-peer-urls=http://etcd:2380' +
                ' -initial-cluster=etcd-node-0=http://etcd:2380'
            ],
        },
        {
            'name': 'apiserver',
            'image': 'k8s.gcr.io/kube-apiserver:v1.23.3',
            'depends_on': [
                'etcd',
                'generate_intentapi_certs',
            ],
            'commands': [
                '/usr/local/bin/kube-apiserver' +
                ' --bind-address=0.0.0.0' +
                ' --secure-port=6443' +
                ' --etcd-servers=http://etcd:2379' +
                ' --client-ca-file=/var/lib/kubernetes/ca.pem' +
                ' --tls-cert-file=/var/lib/kubernetes/kubernetes.pem' +
                ' --tls-private-key-file=/var/lib/kubernetes/kubernetes-key.pem' +
                ' --service-account-key-file=/var/lib/kubernetes/service-account.pem' +
                ' --service-account-signing-key-file=/var/lib/kubernetes/service-account-key.pem' +
                ' --service-account-issuer=https://apiserver:6443',
            ],
            'volumes': [
                {
                    'name': 'intentapi_certs',
                    'path': '/var/lib/kubernetes',
                },
            ],
        },
    ]
    return intentapi_services
