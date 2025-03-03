DROP PROCEDURE IF EXISTS InsertMillionDashboards;

DELIMITER //

CREATE PROCEDURE InsertMillionDashboards()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE new_guid CHAR(36);
    DECLARE unique_name VARCHAR(20);
    DECLARE batch_size INT DEFAULT 10;
    DECLARE stmt_resource TEXT DEFAULT '';
    DECLARE stmt_resource_history TEXT DEFAULT '';
    DECLARE random_number INT;

    WHILE i < 1000000 DO
        -- Generate a unique GUID and unique name
        SET new_guid = UUID();
        SET unique_name = CONCAT('ad5wkqk', i);
        SET @new_uid = CONCAT('dashboard', i);

        -- Generate a random number between 1 and 1000
        SET random_number = FLOOR(1 + (RAND() * 1000));
        SET @stack_namespace = CONCAT('stacks-', random_number);  -- Store stack namespace in a variable

        -- Append the value part of the SQL insert statement to both resource and history inserts
        SET stmt_resource = CONCAT(stmt_resource,
            '(', QUOTE(new_guid), ', ', QUOTE('1730396628210501'), ', ', QUOTE('dashboard.grafana.app'), ', ', QUOTE('dashboards'), ', ',
            QUOTE(@stack_namespace), ', ', QUOTE(unique_name), ', ', QUOTE(CONCAT('{\"kind\":\"Dashboard\",\"apiVersion\":\"dashboard.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"ad5wkqk\",\"namespace\":\"', @stack_namespace, '\",\"uid\":\"', @new_uid, '\",\"creationTimestamp\":\"2024-10-31T17:43:48Z\",\"annotations\":{\"grafana.app/createdBy\":\"user:u000000001\",\"grafana.app/originHash\":\"Grafana v11.4.0-pre (d2d7ae2e86)\",\"grafana.app/originName\":\"UI\",\"grafana.app/originPath\":\"/dashboard/new\"},\"managedFields\":[{\"manager\":\"Mozilla\",\"operation\":\"Update\",\"apiVersion\":\"dashboard.grafana.app/v0alpha1\",\"time\":\"2024-10-31T17:43:48Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:grafana.app/originHash\":{},\"f:grafana.app/originName\":{},\"f:grafana.app/originPath\":{}},\"f:generateName\":{}},\"f:spec\":{\"f:annotations\":{\".\":{},\"f:list\":{}},\"f:description\":{},\"f:editable\":{},\"f:fiscalYearStartMonth\":{},\"f:graphTooltip\":{},\"f:id\":{},\"f:links\":{},\"f:panels\":{},\"f:preload\":{},\"f:schemaVersion\":{},\"f:tags\":{},\"f:templating\":{\".\":{},\"f:list\":{}},\"f:timepicker\":{},\"f:timezone\":{},\"f:title\":{},\"f:uid\":{},\"f:version\":{},\"f:weekStart\":{}}}}]},\"spec\":{\"annotations\":{\"list\":[{\"builtIn\":1,\"datasource\":{\"type\":\"grafana\",\"uid\":\"-- Grafana --\"},\"enable\":true,\"hide\":true,\"iconColor\":\"rgba(0, 211, 255, 1)\",\"name\":\"Annotations \\u0026 Alerts\",\"type\":\"dashboard\"}]},\"description\":\"\",\"editable\":true,\"fiscalYearStartMonth\":0,\"graphTooltip\":0,\"id\":null,\"links\":[],\"panels\":[{\"datasource\":{\"type\":\"grafana-testdata-datasource\",\"uid\":\"PD8C576611E62080A\"},\"fieldConfig\":{\"defaults\":{\"color\":{\"mode\":\"palette-classic\"},\"custom\":{\"axisBorderShow\":false,\"axisCenteredZero\":false,\"axisColorMode\":\"text\",\"axisLabel\":\"\",\"axisPlacement\":\"auto\",\"barAlignment\":0,\"barWidthFactor\":0.6,\"drawStyle\":\"line\",\"fillOpacity\":0,\"gradientMode\":\"none\",\"hideFrom\":{\"legend\":false,\"tooltip\":false,\"viz\":false},\"insertNulls\":false,\"lineInterpolation\":\"linear\",\"lineWidth\":1,\"pointSize\":5,\"scaleDistribution\":{\"type\":\"linear\"},\"showPoints\":\"auto\",\"spanNulls\":false,\"stacking\":{\"group\":\"A\",\"mode\":\"none\"},\"thresholdsStyle\":{\"mode\":\"off\"}},\"mappings\":[],\"thresholds\":{\"mode\":\"absolute\",\"steps\":[{\"color\":\"green\",\"value\":null},{\"color\":\"red\",\"value\":80}]}},\"overrides\":[]},\"gridPos\":{\"h\":8,\"w\":12,\"x\":0,\"y\":0},\"id\":1,\"options\":{\"legend\":{\"calcs\":[],\"displayMode\":\"list\",\"placement\":\"bottom\",\"showLegend\":true},\"tooltip\":{\"mode\":\"single\",\"sort\":\"none\"}},\"pluginVersion\":\"11.4.0-pre\",\"targets\":[{\"datasource\":{\"type\":\"grafana-testdata-datasource\",\"uid\":\"PD8C576611E62080A\"},\"refId\":\"A\"}],\"title\":\"Panel Title\",\"type\":\"timeseries\"}],\"preload\":false,\"schemaVersion\":40,\"tags\":[],\"templating\":{\"list\":[]},\"timepicker\":{},\"timezone\":\"browser\",\"title\":\"dashboard1\",\"uid\":\"\",\"version\":0,\"weekStart\":\"\"}}\n')), ', ', QUOTE('1'), ', NULL, ', QUOTE('0'), '), ');

        SET stmt_resource_history = CONCAT(stmt_resource_history,
            '(', QUOTE(new_guid), ', ', QUOTE('1730396628210501'), ', ', QUOTE('dashboard.grafana.app'), ', ', QUOTE('dashboards'), ', ',
            QUOTE(@stack_namespace), ', ', QUOTE(unique_name), ', ', QUOTE(CONCAT('{\"kind\":\"Dashboard\",\"apiVersion\":\"dashboard.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"ad5wkqk\",\"namespace\":\"', @stack_namespace, '\",\"uid\":\"', @new_uid ,'\",\"creationTimestamp\":\"2024-10-31T17:43:48Z\",\"annotations\":{\"grafana.app/createdBy\":\"user:u000000001\",\"grafana.app/originHash\":\"Grafana v11.4.0-pre (d2d7ae2e86)\",\"grafana.app/originName\":\"UI\",\"grafana.app/originPath\":\"/dashboard/new\"},\"managedFields\":[{\"manager\":\"Mozilla\",\"operation\":\"Update\",\"apiVersion\":\"dashboard.grafana.app/v0alpha1\",\"time\":\"2024-10-31T17:43:48Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:grafana.app/originHash\":{},\"f:grafana.app/originName\":{},\"f:grafana.app/originPath\":{}},\"f:generateName\":{}},\"f:spec\":{\"f:annotations\":{\".\":{},\"f:list\":{}},\"f:description\":{},\"f:editable\":{},\"f:fiscalYearStartMonth\":{},\"f:graphTooltip\":{},\"f:id\":{},\"f:links\":{},\"f:panels\":{},\"f:preload\":{},\"f:schemaVersion\":{},\"f:tags\":{},\"f:templating\":{\".\":{},\"f:list\":{}},\"f:timepicker\":{},\"f:timezone\":{},\"f:title\":{},\"f:uid\":{},\"f:version\":{},\"f:weekStart\":{}}}}]},\"spec\":{\"annotations\":{\"list\":[{\"builtIn\":1,\"datasource\":{\"type\":\"grafana\",\"uid\":\"-- Grafana --\"},\"enable\":true,\"hide\":true,\"iconColor\":\"rgba(0, 211, 255, 1)\",\"name\":\"Annotations \\u0026 Alerts\",\"type\":\"dashboard\"}]},\"description\":\"\",\"editable\":true,\"fiscalYearStartMonth\":0,\"graphTooltip\":0,\"id\":null,\"links\":[],\"panels\":[{\"datasource\":{\"type\":\"grafana-testdata-datasource\",\"uid\":\"PD8C576611E62080A\"},\"fieldConfig\":{\"defaults\":{\"color\":{\"mode\":\"palette-classic\"},\"custom\":{\"axisBorderShow\":false,\"axisCenteredZero\":false,\"axisColorMode\":\"text\",\"axisLabel\":\"\",\"axisPlacement\":\"auto\",\"barAlignment\":0,\"barWidthFactor\":0.6,\"drawStyle\":\"line\",\"fillOpacity\":0,\"gradientMode\":\"none\",\"hideFrom\":{\"legend\":false,\"tooltip\":false,\"viz\":false},\"insertNulls\":false,\"lineInterpolation\":\"linear\",\"lineWidth\":1,\"pointSize\":5,\"scaleDistribution\":{\"type\":\"linear\"},\"showPoints\":\"auto\",\"spanNulls\":false,\"stacking\":{\"group\":\"A\",\"mode\":\"none\"},\"thresholdsStyle\":{\"mode\":\"off\"}},\"mappings\":[],\"thresholds\":{\"mode\":\"absolute\",\"steps\":[{\"color\":\"green\",\"value\":null},{\"color\":\"red\",\"value\":80}]}},\"overrides\":[]},\"gridPos\":{\"h\":8,\"w\":12,\"x\":0,\"y\":0},\"id\":1,\"options\":{\"legend\":{\"calcs\":[],\"displayMode\":\"list\",\"placement\":\"bottom\",\"showLegend\":true},\"tooltip\":{\"mode\":\"single\",\"sort\":\"none\"}},\"pluginVersion\":\"11.4.0-pre\",\"targets\":[{\"datasource\":{\"type\":\"grafana-testdata-datasource\",\"uid\":\"PD8C576611E62080A\"},\"refId\":\"A\"}],\"title\":\"Panel Title\",\"type\":\"timeseries\"}],\"preload\":false,\"schemaVersion\":40,\"tags\":[],\"templating\":{\"list\":[]},\"timepicker\":{},\"timezone\":\"browser\",\"title\":\"dashboard1\",\"uid\":\"\",\"version\":0,\"weekStart\":\"\"}}\n')), ', ', QUOTE('1'), ', NULL, ', QUOTE('0'), '), ');

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

call InsertMillionDashboards();

insert into resource_version values ('dashboard.grafana.app', 'dashboards', 1730396628210501) ON DUPLICATE KEY UPDATE resource_version = 1730396628210501;
