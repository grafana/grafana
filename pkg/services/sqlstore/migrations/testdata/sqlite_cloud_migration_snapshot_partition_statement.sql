CREATE TABLE IF NOT EXISTS `cloud_migration_snapshot_partition_new` (
  `snapshot_uid` TEXT NOT NULL
  , `partition_number` INTEGER NOT NULL
  , `resource_type` TEXT NOT NULL
  , `data` BLOB NOT NULL
  , PRIMARY KEY ( `snapshot_uid`,`resource_type`,`partition_number` ));

INSERT INTO `cloud_migration_snapshot_partition_new` (`snapshot_uid`
 , `partition_number`
 , `resource_type`
 , `data`)
SELECT `snapshot_uid`
 , `partition_number`
 , `resource_type`
 , `data`
FROM `cloud_migration_snapshot_partition`;

DROP TABLE IF EXISTS `cloud_migration_snapshot_partition`;

ALTER TABLE `cloud_migration_snapshot_partition_new` RENAME TO `cloud_migration_snapshot_partition`;
