DROP PROCEDURE IF EXISTS InsertMillionPlaylists;

DELIMITER //

CREATE PROCEDURE InsertMillionPlaylists()
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE new_guid CHAR(36);
  DECLARE unique_name VARCHAR(20);
  DECLARE batch_size INT DEFAULT 25;
  DECLARE stmt_resource TEXT DEFAULT '';
  DECLARE stmt_resource_history TEXT DEFAULT '';
  DECLARE random_number INT;

  WHILE i < 1000000 DO
      -- Generate a unique GUID and unique name
      SET new_guid = UUID();
      SET unique_name = CONCAT('playlist', i);
      SET @new_uid = CONCAT('playlist', i);

      -- Generate a random number between 1 and 1000
      SET random_number = FLOOR(1 + (RAND() * 1000));
      SET @stack_namespace = CONCAT('stacks-', random_number);  -- Store stack namespace in a variable

      -- Append the value part of the SQL insert statement to both resource and history inserts
      SET stmt_resource = CONCAT(stmt_resource,
       '(', QUOTE(new_guid), ', ', QUOTE('1729715497301945'), ', ', QUOTE('playlist.grafana.app'), ', ', QUOTE('playlists'), ', ',
       QUOTE(@stack_namespace), ', ', QUOTE(unique_name), ', ',
       QUOTE(CONCAT(
         '{\"kind\":\"Playlist\",\"apiVersion\":\"playlist.grafana.app/v0alpha1\",\"metadata\":{',
         '\"name\":\"', unique_name, '\",\"namespace\":\"', @stack_namespace, '\",\"uid\":\"', @new_uid, '\",',
         '\"resourceVersion\":\"1729715497301945\",\"creationTimestamp\":\"2024-10-05T02:17:49Z\",',
         '\"annotations\":{\"grafana.app/createdBy\":\"user:u000000002\",\"grafana.app/originName\":\"SQL\",',
         '\"grafana.app/originPath\":\"10182\",\"grafana.app/originTimestamp\":\"2024-10-05T02:17:49Z\",',
         '\"grafana.app/updatedBy\":\"service-account:\",\"grafana.app/updatedTimestamp\":\"2024-10-23T21:00:21Z\"}},',
         '\"spec\":{\"interval\":\"5m\",\"items\":[{\"type\":\"dashboard_by_uid\",\"value\":\"a6232629-98b3-42fa-91a4-579a43fbcda0\"},',
         '{\"type\":\"dashboard_by_tag\",\"value\":\"tag1\"},{\"type\":\"dashboard_by_tag\",\"value\":\"tag2\"}],',
         '\"title\":\"k6 test playlist create cp3f14j11tthck1\"},\"status\":{}}'
             )),
       ', ', QUOTE('1'), ', NULL, ', QUOTE('0'), '), ');

      SET stmt_resource_history = CONCAT(stmt_resource_history,
       '(', QUOTE(new_guid), ', ', QUOTE('1729715497301945'), ', ', QUOTE('playlist.grafana.app'), ', ', QUOTE('playlists'), ', ',
       QUOTE(@stack_namespace), ', ', QUOTE(unique_name), ', ',
       QUOTE(CONCAT(
         '{\"kind\":\"Playlist\",\"apiVersion\":\"playlist.grafana.app/v0alpha1\",\"metadata\":{',
         '\"name\":\"', unique_name, '\",\"namespace\":\"', @stack_namespace, '\",\"uid\":\"', @new_uid, '\",',
         '\"resourceVersion\":\"1729715497301945\",\"creationTimestamp\":\"2024-10-05T02:17:49Z\",',
         '\"annotations\":{\"grafana.app/createdBy\":\"user:u000000002\",\"grafana.app/originName\":\"SQL\",',
         '\"grafana.app/originPath\":\"10182\",\"grafana.app/originTimestamp\":\"2024-10-05T02:17:49Z\",',
         '\"grafana.app/updatedBy\":\"service-account:\",\"grafana.app/updatedTimestamp\":\"2024-10-23T21:00:21Z\"}},',
         '\"spec\":{\"interval\":\"5m\",\"items\":[{\"type\":\"dashboard_by_uid\",\"value\":\"a6232629-98b3-42fa-91a4-579a43fbcda0\"},',
         '{\"type\":\"dashboard_by_tag\",\"value\":\"tag1\"},{\"type\":\"dashboard_by_tag\",\"value\":\"tag2\"}],',
         '\"title\":\"k6 test playlist create cp3f14j11tthck1\"},\"status\":{}}'
             )), ', ', QUOTE('1'), ', NULL, ', QUOTE('0'), '), ');

      SET i = i + 1;

      -- Execute statements in batches to avoid reaching the TEXT limit
      IF i % batch_size = 0 THEN
        -- Remove the last comma and space
        SET stmt_resource = LEFT(stmt_resource, LENGTH(stmt_resource) - 2);
        SET stmt_resource_history = LEFT(stmt_resource_history, LENGTH(stmt_resource_history) - 2);

        -- Insert current batch into `resource`
        SET @stmt_resource = CONCAT('INSERT INTO `resource` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`) VALUES ', stmt_resource);
        PREPARE stmt_resource_stmt FROM @stmt_resource;
        EXECUTE stmt_resource_stmt;
        DEALLOCATE PREPARE stmt_resource_stmt;

-- Insert current batch into `resource_history`
        SET @stmt_resource_history = CONCAT('INSERT INTO `resource_history` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`) VALUES ', stmt_resource_history);
        PREPARE stmt_resource_history_stmt FROM @stmt_resource_history;
        EXECUTE stmt_resource_history_stmt;
        DEALLOCATE PREPARE stmt_resource_history_stmt;

-- Reset the batch for the next iteration
        SET stmt_resource = '';
        SET stmt_resource_history = '';
      END IF;
    END WHILE;

  -- Insert any remaining records if they don't fill a full batch
  IF stmt_resource != '' THEN
    SET stmt_resource = LEFT(stmt_resource, LENGTH(stmt_resource) - 2);
    SET stmt_resource_history = LEFT(stmt_resource_history, LENGTH(stmt_resource_history) - 2);

    SET @stmt_resource = CONCAT('INSERT INTO `resource` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`) VALUES ', stmt_resource);
    PREPARE stmt_resource_stmt FROM @stmt_resource;
    EXECUTE stmt_resource_stmt;
    DEALLOCATE PREPARE stmt_resource_stmt;

    SET @stmt_resource_history = CONCAT('INSERT INTO `resource_history` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`) VALUES ', stmt_resource_history);
    PREPARE stmt_resource_history_stmt FROM @stmt_resource_history;
    EXECUTE stmt_resource_history_stmt;
    DEALLOCATE PREPARE stmt_resource_history_stmt;
  END IF;
END //

DELIMITER ;

call InsertMillionPlaylists();

insert into resource_version values ('playlist.grafana.app', 'playlists', 1729715497301945) ON DUPLICATE KEY UPDATE resource_version = 1729715497301945;
