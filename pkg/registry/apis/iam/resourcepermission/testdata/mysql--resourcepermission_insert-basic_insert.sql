INSERT INTO `grafana`.`permission` (role_id, action, scope, created, updated, kind, attribute, identifier)
VALUES 
    (
        123,
        'read',
        'dashboards:*',
        '2023-01-01 00:00:00 +0000 UTC',
        '2023-01-01 00:00:00 +0000 UTC',
        'dashboard',
        '',
        ''
    ),
    (
        123,
        'write',
        'dashboards:uid:abc123',
        '2023-01-01 00:00:00 +0000 UTC',
        '2023-01-01 00:00:00 +0000 UTC',
        'dashboard',
        '',
        'abc123'
    ); 
