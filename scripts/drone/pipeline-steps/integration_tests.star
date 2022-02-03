load('scripts/drone/utils/var.star', 'build_image')

def postgres_integration_tests_step(edition, ver_mode):
    deps = []
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release-branch', 'release'):
        deps.extend(['initialize'])
    else:
        deps.extend(['grabpl'])
    return {
        'name': 'postgres-integration-tests',
        'image': build_image,
        'depends_on': deps,
        'environment': {
            'PGPASSWORD': 'grafanatest',
            'GRAFANA_TEST_DB': 'postgres',
            'POSTGRES_HOST': 'postgres',
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq postgresql-client',
            'dockerize -wait tcp://postgres:5432 -timeout 120s',
            'psql -p 5432 -h postgres -U grafanatest -d grafanatest -f ' +
            'devenv/docker/blocks/postgres_tests/setup.sql',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            './bin/grabpl integration-tests --database postgres',
            ],
    }


def mysql_integration_tests_step(edition, ver_mode):
    deps = []
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release-branch', 'release'):
        deps.extend(['initialize'])
    else:
        deps.extend(['grabpl'])
    return {
        'name': 'mysql-integration-tests',
        'image': build_image,
        'depends_on': deps,
        'environment': {
            'GRAFANA_TEST_DB': 'mysql',
            'MYSQL_HOST': 'mysql',
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq default-mysql-client',
            'dockerize -wait tcp://mysql:3306 -timeout 120s',
            'cat devenv/docker/blocks/mysql_tests/setup.sql | mysql -h mysql -P 3306 -u root -prootpass',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            './bin/grabpl integration-tests --database mysql',
        ],
    }


def redis_integration_tests_step(edition, ver_mode):
    deps = []
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release-branch', 'release'):
        deps.extend(['initialize'])
    else:
        deps.extend(['grabpl'])
    return {
        'name': 'redis-integration-tests',
        'image': build_image,
        'depends_on': deps,
        'environment': {
            'REDIS_URL': 'redis://redis:6379/0',
        },
        'commands': [
            'dockerize -wait tcp://redis:6379/0 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }


def memcached_integration_tests_step(edition, ver_mode):
    deps = []
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release-branch', 'release'):
        deps.extend(['initialize'])
    else:
        deps.extend(['grabpl'])
    return {
        'name': 'memcached-integration-tests',
        'image': build_image,
        'depends_on': deps,
        'environment': {
            'MEMCACHED_HOSTS': 'memcached:11211',
        },
        'commands': [
            'dockerize -wait tcp://memcached:11211 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }

def benchmark_ldap_step():
    return {
        'name': 'benchmark-ldap',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'LDAP_HOSTNAME': 'ldap',
        },
        'commands': [
            'dockerize -wait tcp://ldap:389 -timeout 120s',
            'go test -benchmem -run=^$ ./pkg/extensions/ldapsync -bench "^(Benchmark50Users)$"',
        ],
    }
