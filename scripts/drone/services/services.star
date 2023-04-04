"""
This module has functions for Drone services to be used in pipelines.
"""

def integration_test_services_volumes():
    return [
        {"name": "postgres", "temp": {"medium": "memory"}},
        {"name": "mysql", "temp": {"medium": "memory"}},
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
            "name": "mysql",
            "image": "mysql:5.7.39",
            "environment": {
                "MYSQL_ROOT_PASSWORD": "rootpass",
                "MYSQL_DATABASE": "grafana_tests",
                "MYSQL_USER": "grafana",
                "MYSQL_PASSWORD": "password",
            },
            "volumes": [{"name": "mysql", "path": "/var/lib/mysql"}],
        },
    ]

    services.extend(
        [
            {
                "name": "redis",
                "image": "bitnami/redis:6.2-debian-10",
                "environment": {},
            },
            {
                "name": "memcached",
                "image": "memcached:1.6.9-alpine",
                "environment": {},
            },
        ],
    )

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
