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
                ' -name=etcd-node-0' +
                ' -listen-client-urls=http://0.0.0.0:2379' +
                ' -advertise-client-urls=http://0.0.0.0:2379' +
                ' -initial-advertise-peer-urls=http://0.0.0.0:2380' +
                ' -listen-peer-urls=http://0.0.0.0:2380' +
                ' -initial-cluster=etcd-node-0=http://0.0.0.0:2380'
            ],
        },
        {
            'name': 'apiserver',
            'image': 'build_image',
            'depends_on': [
                'etcd',
                'generate_intentapi_certs',
            ],
            'detach': True,
            'commands': [
                'apt-get update',
                'apt-get install -yq kubectl',
                'curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
                'chmod +x /usr/local/bin/docker-compose',
                'ls -l /drone/src/devenv/docker/blocks/intentapi/certs',
                'ls -l /var/lib/kubernetes',
                'make devenv sources=intentapi',
                'cd /drone/src/devenv && docker-compose ps && docker-compose logs -f apiserver',
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
