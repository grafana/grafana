CREATE DATABASE IF NOT EXISTS `stack24`;
CREATE DATABASE IF NOT EXISTS `stack25`;
CREATE DATABASE IF NOT EXISTS `stack26`;

-- Database used by the entity store service
-- note this should not really be used/shared
CREATE DATABASE IF NOT EXISTS `entitysvc`;


GRANT ALL ON *.* TO 'grafana'@'%';

