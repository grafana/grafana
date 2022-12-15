-- alert alert_configuration alertmanager_configuration column from TEXT to MEDIUMTEXT if mysql
ALTER TABLE alert_configuration MODIFY alertmanager_configuration MEDIUMTEXT;
