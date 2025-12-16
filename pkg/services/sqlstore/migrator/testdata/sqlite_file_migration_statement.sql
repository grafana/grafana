CREATE TABLE IF NOT EXISTS `file_new` (
    `path` TEXT NOT NULL
    , `path_hash` TEXT PRIMARY KEY NOT NULL
    , `parent_folder_path_hash` TEXT NOT NULL
    , `contents` BLOB NOT NULL
    , `etag` TEXT NOT NULL
    , `cache_control` TEXT NOT NULL
    , `content_disposition` TEXT NOT NULL
    , `updated` DATETIME NOT NULL
    , `created` DATETIME NOT NULL
    , `size` INTEGER NOT NULL
    , `mime_type` TEXT NOT NULL
);

INSERT INTO `file_new` (`path`
  , `path_hash`
  , `parent_folder_path_hash`
  , `contents`
  , `etag`
  , `cache_control`
  , `content_disposition`
  , `updated`
  , `created`
  , `size`
  , `mime_type`)
SELECT `path`
  , `path_hash`
  , `parent_folder_path_hash`
  , `contents`
  , `etag`
  , `cache_control`
  , `content_disposition`
  , `updated`
  , `created`
  , `size`
  , `mime_type`
FROM `file`;

DROP TABLE IF EXISTS `file`;
ALTER TABLE `file_new` RENAME TO `file`;
CREATE INDEX `IDX_file_parent_folder_path_hash` ON `file` (`parent_folder_path_hash`);
