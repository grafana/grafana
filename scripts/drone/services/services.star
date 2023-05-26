"""
This module has functions for Drone services to be used in pipelines.
"""

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
            "image": "postgres:12.3-alpine",
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
            "image": "mysql:5.7.39",
            "environment": {
                "MYSQL_ROOT_PASSWORD": "rootpass",
                "MYSQL_DATABASE": "grafana_tests",
                "MYSQL_USER": "grafana",
                "MYSQL_PASSWORD": "password",
            },
            "volumes": [{"name": "mysql57", "path": "/var/lib/mysql"}],
        },
        {
            "name": "mysql80",
            "image": "mysql:8.0.32",
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
            "image": "redis:6.2.11-alpine",
            "environment": {},
        },
        {
            "name": "memcached",
            "image": "memcached:1.6.9-alpine",
            "environment": {},
        },
    ]

    return services

def ldap_service():
    return {
        "name": "ldap",
        "image": "osixia/openldap:1.4.0",
        "environment": {
            "LDAP_ADMIN_PASSWORD": "grafana",
            "LDAP_DOMAIN": "grafana.org",
            "SLAPD_ADDITIONAL_MODULES": "memberof",
        },
    }
