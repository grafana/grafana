CREATE TABLE IF NOT EXISTS `file_new` (
    `path` TEXT NOT NULL
    , `path_hash` TEXT NOT NULL
    , `parent_folder_path_hash` TEXT NOT NULL
    , `contents` BLOB NOT NULL
    , `etag` TEXT NOT NULL
    , PRIMARY KEY ( `path_hash`,`etag` ));

INSERT INTO `file_new` (`path`
  , `path_hash`
  , `parent_folder_path_hash`
  , `contents`
  , `etag`)
SELECT `path`
  , `path_hash`
  , `parent_folder_path_hash`
  , `contents`
  , `etag`
FROM `file`;

DROP TABLE IF EXISTS `file`;
ALTER TABLE `file_new` RENAME TO `file`;
CREATE INDEX `IDX_file_parent_folder_path_hash` ON `file` (`parent_folder_path_hash`);
