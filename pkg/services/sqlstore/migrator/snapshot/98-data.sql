-- MySQL dump 10.13  Distrib 8.4.5, for Linux (x86_64)
--
-- Host: localhost    Database: grafana
-- ------------------------------------------------------
-- Server version	8.4.5
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `alert`
--


--
-- Dumping data for table `alert_image`
--


--
-- Dumping data for table `alert_instance`
--


--
-- Dumping data for table `alert_notification`
--


--
-- Dumping data for table `alert_notification_state`
--


--
-- Dumping data for table `alert_rule`
--


--
-- Dumping data for table `alert_rule_state`
--


--
-- Dumping data for table `alert_rule_tag`
--


--
-- Dumping data for table `alert_rule_version`
--


--
-- Dumping data for table `annotation`
--


--
-- Dumping data for table `annotation_tag`
--


--
-- Dumping data for table `anon_device`
--


--
-- Dumping data for table `api_key`
--


--
-- Dumping data for table `cache_data`
--


--
-- Dumping data for table `cloud_migration_resource`
--


--
-- Dumping data for table `cloud_migration_session`
--


--
-- Dumping data for table `cloud_migration_snapshot`
--


--
-- Dumping data for table `cloud_migration_snapshot_partition`
--


--
-- Dumping data for table `correlation`
--


--
-- Dumping data for table `dashboard`
--


--
-- Dumping data for table `dashboard_acl`
--

INSERT INTO `dashboard_acl` (`id`, `org_id`, `dashboard_id`, `user_id`, `team_id`, `permission`, `role`, `created`, `updated`) VALUES
  (1,-1,-1,NULL,NULL,1,'Viewer','2022-01-01 00:00:00','2022-01-01 00:00:00'),
  (2,-1,-1,NULL,NULL,2,'Editor','2022-01-01 00:00:00','2022-01-01 00:00:00');

--
-- Dumping data for table `dashboard_provisioning`
--


--
-- Dumping data for table `dashboard_public`
--


--
-- Dumping data for table `dashboard_public_email_share`
--


--
-- Dumping data for table `dashboard_public_magic_link`
--


--
-- Dumping data for table `dashboard_public_session`
--


--
-- Dumping data for table `dashboard_public_usage_by_day`
--


--
-- Dumping data for table `dashboard_snapshot`
--


--
-- Dumping data for table `dashboard_tag`
--


--
-- Dumping data for table `dashboard_usage_by_day`
--


--
-- Dumping data for table `dashboard_usage_sums`
--


--
-- Dumping data for table `dashboard_version`
--


--
-- Dumping data for table `data_keys`
--


--
-- Dumping data for table `data_source`
--


--
-- Dumping data for table `data_source_acl`
--


--
-- Dumping data for table `data_source_cache`
--


--
-- Dumping data for table `data_source_usage_by_day`
--


--
-- Dumping data for table `entity_event`
--


--
-- Dumping data for table `file`
--


--
-- Dumping data for table `file_meta`
--


--
-- Dumping data for table `folder`
--


--
-- Dumping data for table `kv_leases`
--


--
-- Dumping data for table `library_element`
--


--
-- Dumping data for table `library_element_connection`
--


--
-- Dumping data for table `license_token`
--


--
-- Dumping data for table `login_attempt`
--


--
-- Dumping data for table `ngalert_configuration`
--


--
-- Dumping data for table `pending_tenant_deletions`
--


--
-- Dumping data for table `playlist`
--


--
-- Dumping data for table `playlist_item`
--


--
-- Dumping data for table `plugin_setting`
--


--
-- Dumping data for table `preferences`
--


--
-- Dumping data for table `provenance_type`
--


--
-- Dumping data for table `query_history`
--


--
-- Dumping data for table `query_history_details`
--


--
-- Dumping data for table `query_history_star`
--


--
-- Dumping data for table `quota`
--


--
-- Dumping data for table `recording_rules`
--


--
-- Dumping data for table `remote_write_targets`
--


--
-- Dumping data for table `report`
--


--
-- Dumping data for table `report_dashboards`
--


--
-- Dumping data for table `report_settings`
--


--
-- Dumping data for table `resource`
--

INSERT INTO `resource` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`, `folder`) VALUES
  ('10878079-688e-4a69-95ad-3793bbca5c02',1779283556271438,'advisor.grafana.app','checktypes','default','datasource','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"datasource\",\"namespace\":\"default\",\"uid\":\"24d4ecf3-a248-4161-8dd9-726ef7782a69\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"data source\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"datasource\",\"steps\":[{\"title\":\"UID validation\",\"description\":\"Checks if the UID of a data source is valid.\",\"stepID\":\"uid-validation\",\"resolution\":\"Check the \\u003ca href=\'https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement\'target=_blank\\u003edocumentation\\u003c/a\\u003e for more information or delete the data source and create a new one.\"},{\"title\":\"Health check\",\"description\":\"Checks if a data source is healthy.\",\"stepID\":\"health-check\",\"resolution\":\"Go to the data source configuration page and address the issues reported.\"},{\"title\":\"Missing plugin check\",\"description\":\"Checks if the plugin associated with the data source is installed and available.\",\"stepID\":\"missing-plugin\",\"resolution\":\"Delete the datasource or install the plugin.\"},{\"title\":\"Prometheus deprecated authentication check\",\"description\":\"Checks if Prometheus data sources are using deprecated authentication methods (Azure auth and SigV4)\",\"stepID\":\"prom-dep-auth\",\"resolution\":\"Make sure that \'Azure Monitor Managed Service for Prometheus\' and/or \'Amazon Managed Service for Prometheus\' plugins are installed. If the data source is provisioned, edit data source type in the provisioning file to use \'grafana-amazonprometheus-datasource\' or \'grafana-azureprometheus-datasource\'.\"}]},\"status\":{}}\n',1,NULL,0,''),
  ('4e12e6ac-fa6b-48fd-ade5-e3591dd8bb01',1779283556435160,'advisor.grafana.app','checktypes','default','instance','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"instance\",\"namespace\":\"default\",\"uid\":\"75fa2caa-a8da-41e7-96a1-e64b23914c83\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"instance attribute\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"instance\",\"steps\":[{\"title\":\"Grafana version check\",\"description\":\"Check if the current Grafana version is out of support.\",\"stepID\":\"out_of_support_version\",\"resolution\":\"Out of support versions will not receive security updates or bug fixes. Upgrade to a more recent version. \\u003ca href=\'https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support\' target=\'_blank\'\\u003eLearn more about version support\\u003c/a\\u003e.\"}]},\"status\":{}}\n',1,NULL,0,''),
  ('9f429cc3-ba06-4b34-b3d1-02eb813e97d1',1779283556317846,'advisor.grafana.app','checktypes','default','plugin','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"plugin\",\"namespace\":\"default\",\"uid\":\"867ade03-c028-454f-bc5f-8b24a04126cf\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"plugin\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"plugin\",\"steps\":[{\"title\":\"Deprecation check\",\"description\":\"Check if any installed plugins are deprecated.\",\"stepID\":\"deprecation\",\"resolution\":\"Check the \\u003ca href=\'https://grafana.com/legal/plugin-deprecation/#a-plugin-i-use-is-deprecated-what-should-i-do\'target=_blank\\u003edocumentation\\u003c/a\\u003e for recommended steps or delete the plugin.\"},{\"title\":\"Update check\",\"description\":\"Checks if an installed plugins has a newer version available.\",\"stepID\":\"update\",\"resolution\":\"There are newer versions available for the plugins listed below. We recommend going to the plugin admin page and upgrading to the latest version.\"},{\"title\":\"Plugin signature check\",\"description\":\"Checks if the plugin\'s signature is missing or invalid.\",\"stepID\":\"unsigned\",\"resolution\":\"For security, we recommend only installing plugins from the catalog. Review the plugin\'s status and verify your allowlist if appropriate.\"},{\"title\":\"TwinMaker SceneViewer deprecation check\",\"description\":\"Warns when the Grafana IoT TwinMaker App is installed that the SceneViewer panel will stop working in Grafana 13.1.\",\"stepID\":\"twinmaker_sceneviewer\",\"resolution\":\"The SceneViewer panel in the TwinMaker App will stop working in Grafana 13.1. Ignore or silence this warning if you are not using the SceneViewer panel.\"}]},\"status\":{}}\n',1,NULL,0,''),
  ('c77fbadf-ce1b-4492-a410-40a29dc71c0e',1779283556404439,'advisor.grafana.app','checktypes','default','config','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"config\",\"namespace\":\"default\",\"uid\":\"1d06551d-6113-4cca-978d-ff38bc17da29\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"config setting\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"config\",\"steps\":[{\"title\":\"Security config check\",\"description\":\"Checks if the Grafana security configuration is set correctly.\",\"stepID\":\"security_config\",\"resolution\":\"Follow the documentation for each element.\"}]},\"status\":{}}\n',1,NULL,0,''),
  ('c9dda8bd-399f-4012-971f-a25df155f6a2',1779283556363516,'advisor.grafana.app','checktypes','default','ssosetting','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"ssosetting\",\"namespace\":\"default\",\"uid\":\"e7bca670-1e84-4be8-8952-735c0bf99241\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"SSO setting\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"ssosetting\",\"steps\":[{\"title\":\"SSO List Setting Format Validation\",\"description\":\"Checks if list configs in SSO settings are in a valid list format (space-separated, comma-separated or JSON array).\",\"stepID\":\"sso-list-format-validation\",\"resolution\":\"Configure the relevant SSO setting using a valid format, like space-separated (\\\"opt1 opt2\\\"), comma-separated values (\\\"opt1, opt2\\\") or JSON array format ([\\\"opt1\\\", \\\"opt2\\\"]).\"}]},\"status\":{}}\n',1,NULL,0,'');

--
-- Dumping data for table `resource_blob`
--


--
-- Dumping data for table `resource_events`
--


--
-- Dumping data for table `resource_history`
--

INSERT INTO `resource_history` (`guid`, `resource_version`, `group`, `resource`, `namespace`, `name`, `value`, `action`, `label_set`, `previous_resource_version`, `folder`, `generation`, `key_path`) VALUES
  ('10878079-688e-4a69-95ad-3793bbca5c02',1779283556271438,'advisor.grafana.app','checktypes','default','datasource','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"datasource\",\"namespace\":\"default\",\"uid\":\"24d4ecf3-a248-4161-8dd9-726ef7782a69\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"data source\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"datasource\",\"steps\":[{\"title\":\"UID validation\",\"description\":\"Checks if the UID of a data source is valid.\",\"stepID\":\"uid-validation\",\"resolution\":\"Check the \\u003ca href=\'https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement\'target=_blank\\u003edocumentation\\u003c/a\\u003e for more information or delete the data source and create a new one.\"},{\"title\":\"Health check\",\"description\":\"Checks if a data source is healthy.\",\"stepID\":\"health-check\",\"resolution\":\"Go to the data source configuration page and address the issues reported.\"},{\"title\":\"Missing plugin check\",\"description\":\"Checks if the plugin associated with the data source is installed and available.\",\"stepID\":\"missing-plugin\",\"resolution\":\"Delete the datasource or install the plugin.\"},{\"title\":\"Prometheus deprecated authentication check\",\"description\":\"Checks if Prometheus data sources are using deprecated authentication methods (Azure auth and SigV4)\",\"stepID\":\"prom-dep-auth\",\"resolution\":\"Make sure that \'Azure Monitor Managed Service for Prometheus\' and/or \'Amazon Managed Service for Prometheus\' plugins are installed. If the data source is provisioned, edit data source type in the provisioning file to use \'grafana-amazonprometheus-datasource\' or \'grafana-azureprometheus-datasource\'.\"}]},\"status\":{}}\n',1,NULL,0,'',1,'unified/data/advisor.grafana.app/checktypes/default/datasource/2057090447657927094~created~'),
  ('4e12e6ac-fa6b-48fd-ade5-e3591dd8bb01',1779283556435160,'advisor.grafana.app','checktypes','default','instance','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"instance\",\"namespace\":\"default\",\"uid\":\"75fa2caa-a8da-41e7-96a1-e64b23914c83\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"instance attribute\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"instance\",\"steps\":[{\"title\":\"Grafana version check\",\"description\":\"Check if the current Grafana version is out of support.\",\"stepID\":\"out_of_support_version\",\"resolution\":\"Out of support versions will not receive security updates or bug fixes. Upgrade to a more recent version. \\u003ca href=\'https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support\' target=\'_blank\'\\u003eLearn more about version support\\u003c/a\\u003e.\"}]},\"status\":{}}\n',1,NULL,0,'',1,'unified/data/advisor.grafana.app/checktypes/default/instance/2057090448345792672~created~'),
  ('9f429cc3-ba06-4b34-b3d1-02eb813e97d1',1779283556317846,'advisor.grafana.app','checktypes','default','plugin','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"plugin\",\"namespace\":\"default\",\"uid\":\"867ade03-c028-454f-bc5f-8b24a04126cf\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"plugin\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"plugin\",\"steps\":[{\"title\":\"Deprecation check\",\"description\":\"Check if any installed plugins are deprecated.\",\"stepID\":\"deprecation\",\"resolution\":\"Check the \\u003ca href=\'https://grafana.com/legal/plugin-deprecation/#a-plugin-i-use-is-deprecated-what-should-i-do\'target=_blank\\u003edocumentation\\u003c/a\\u003e for recommended steps or delete the plugin.\"},{\"title\":\"Update check\",\"description\":\"Checks if an installed plugins has a newer version available.\",\"stepID\":\"update\",\"resolution\":\"There are newer versions available for the plugins listed below. We recommend going to the plugin admin page and upgrading to the latest version.\"},{\"title\":\"Plugin signature check\",\"description\":\"Checks if the plugin\'s signature is missing or invalid.\",\"stepID\":\"unsigned\",\"resolution\":\"For security, we recommend only installing plugins from the catalog. Review the plugin\'s status and verify your allowlist if appropriate.\"},{\"title\":\"TwinMaker SceneViewer deprecation check\",\"description\":\"Warns when the Grafana IoT TwinMaker App is installed that the SceneViewer panel will stop working in Grafana 13.1.\",\"stepID\":\"twinmaker_sceneviewer\",\"resolution\":\"The SceneViewer panel in the TwinMaker App will stop working in Grafana 13.1. Ignore or silence this warning if you are not using the SceneViewer panel.\"}]},\"status\":{}}\n',1,NULL,0,'',1,'unified/data/advisor.grafana.app/checktypes/default/plugin/2057090447850865486~created~'),
  ('c77fbadf-ce1b-4492-a410-40a29dc71c0e',1779283556404439,'advisor.grafana.app','checktypes','default','config','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"config\",\"namespace\":\"default\",\"uid\":\"1d06551d-6113-4cca-978d-ff38bc17da29\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"config setting\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"config\",\"steps\":[{\"title\":\"Security config check\",\"description\":\"Checks if the Grafana security configuration is set correctly.\",\"stepID\":\"security_config\",\"resolution\":\"Follow the documentation for each element.\"}]},\"status\":{}}\n',1,NULL,0,'',1,'unified/data/advisor.grafana.app/checktypes/default/config/2057090448215769527~created~'),
  ('c9dda8bd-399f-4012-971f-a25df155f6a2',1779283556363516,'advisor.grafana.app','checktypes','default','ssosetting','{\"kind\":\"CheckType\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"metadata\":{\"name\":\"ssosetting\",\"namespace\":\"default\",\"uid\":\"e7bca670-1e84-4be8-8952-735c0bf99241\",\"generation\":1,\"creationTimestamp\":\"2026-05-20T13:25:56Z\",\"labels\":{\"grafana-app-sdk-resource-version\":\"v0alpha1\"},\"annotations\":{\"advisor.grafana.app/checktype-name\":\"SSO setting\",\"advisor.grafana.app/ignore-steps\":\"1\",\"advisor.grafana.app/retry\":\"1\",\"grafana.app/createdBy\":\"access-policy:service\"},\"managedFields\":[{\"manager\":\"Run_Grafana\",\"operation\":\"Update\",\"apiVersion\":\"advisor.grafana.app/v0alpha1\",\"time\":\"2026-05-20T13:25:56Z\",\"fieldsType\":\"FieldsV1\",\"fieldsV1\":{\"f:metadata\":{\"f:annotations\":{\".\":{},\"f:advisor.grafana.app/checktype-name\":{},\"f:advisor.grafana.app/ignore-steps\":{},\"f:advisor.grafana.app/retry\":{}},\"f:labels\":{\".\":{},\"f:grafana-app-sdk-resource-version\":{}}},\"f:spec\":{\"f:name\":{},\"f:steps\":{}}}}]},\"spec\":{\"name\":\"ssosetting\",\"steps\":[{\"title\":\"SSO List Setting Format Validation\",\"description\":\"Checks if list configs in SSO settings are in a valid list format (space-separated, comma-separated or JSON array).\",\"stepID\":\"sso-list-format-validation\",\"resolution\":\"Configure the relevant SSO setting using a valid format, like space-separated (\\\"opt1 opt2\\\"), comma-separated values (\\\"opt1, opt2\\\") or JSON array format ([\\\"opt1\\\", \\\"opt2\\\"]).\"}]},\"status\":{}}\n',1,NULL,0,'',1,'unified/data/advisor.grafana.app/checktypes/default/ssosetting/2057090448043803140~created~');

--
-- Dumping data for table `secret_data_key`
--


--
-- Dumping data for table `secret_encrypted_value`
--


--
-- Dumping data for table `secret_keeper`
--


--
-- Dumping data for table `secret_secure_value`
--


--
-- Dumping data for table `secrets`
--


--
-- Dumping data for table `session`
--


--
-- Dumping data for table `setting`
--


--
-- Dumping data for table `short_url`
--


--
-- Dumping data for table `signing_key`
--


--
-- Dumping data for table `sso_setting`
--


--
-- Dumping data for table `star`
--


--
-- Dumping data for table `tag`
--


--
-- Dumping data for table `team`
--


--
-- Dumping data for table `team_group`
--


--
-- Dumping data for table `team_member`
--


--
-- Dumping data for table `team_role`
--


--
-- Dumping data for table `temp_user`
--


--
-- Dumping data for table `test_data`
--


--
-- Dumping data for table `user_auth`
--


--
-- Dumping data for table `user_auth_token`
--


--
-- Dumping data for table `user_dashboard_views`
--


--
-- Dumping data for table `user_external_session`
--


--
-- Dumping data for table `user_role`
--


--
-- Dumping data for table `user_stats`
--

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

