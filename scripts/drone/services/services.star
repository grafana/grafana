"""
This module has functions for Drone services to be used in pipelines.
"""

load(
    "scripts/drone/utils/images.star",
    "images",
)

def integration_test_services_volumes():
    return [
        {"name": "postgres", "temp": {"medium": "memory"}},
        {"name": "mysql57", "temp": {"medium": "memory"}},
        {"name": "mysql80", "temp": {"medium": "memory"}},
    ]

def integration_test_services():
    services = [
        {
            "name": "postgres",
            "image": images["postgres_alpine_image"],
            "environment": {
                "POSTGRES_USER": "grafanatest",
                "POSTGRES_PASSWORD": "grafanatest",
                "POSTGRES_DB": "grafanatest",
                "PGDATA": "/var/lib/postgresql/data/pgdata",
            },
            "volumes": [
                {"name": "postgres", "path": "/var/lib/postgresql/data/pgdata"},
            ],
        },
        {
            "name": "mysql57",
            "image": images["mysql5_image"],
            "environment": {
                "MYSQL_ROOT_PASSWORD": "rootpass",
                "MYSQL_DATABASE": "grafana_tests",
                "MYSQL_USER": "grafana",
                "MYSQL_PASSWORD": "password",
            },
            "volumes": [{"name": "mysql57", "path": "/var/lib/mysql"}],
            "commands": ["docker-entrypoint.sh mysqld --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci"],
        },
        {
            "name": "mysql80",
            "image": images["mysql8_image"],
            "environment": {
                "MYSQL_ROOT_PASSWORD": "rootpass",
                "MYSQL_DATABASE": "grafana_tests",
                "MYSQL_USER": "grafana",
                "MYSQL_PASSWORD": "password",
            },
            "volumes": [{"name": "mysql80", "path": "/var/lib/mysql"}],
            "commands": ["docker-entrypoint.sh mysqld --default-authentication-plugin=mysql_native_password"],
        },
        {
            "name": "redis",
            "image": images["redis_alpine_image"],
            "environment": {},
        },
        {
            "name": "memcached",
            "image": images["memcached_alpine_image"],
            "environment": {},
        },
    ]

    return services

def ldap_service():
    return {
        "name": "ldap",
        "image": images["openldap_image"],
        "environment": {
            "LDAP_ADMIN_PASSWORD": "grafana",
            "LDAP_DOMAIN": "grafana.org",
            "SLAPD_ADDITIONAL_MODULES": "memberof",
        },
    }
