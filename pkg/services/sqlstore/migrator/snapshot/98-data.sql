-- MySQL dump 10.13  Distrib 8.0.32, for Linux (aarch64)
--
-- Host: localhost    Database: grafana
-- ------------------------------------------------------
-- Server version	8.0.32
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


--
-- Dumping data for table `resource_blob`
--


--
-- Dumping data for table `resource_events`
--


--
-- Dumping data for table `resource_history`
--


--
-- Dumping data for table `resource_last_import_time`
--


--
-- Dumping data for table `resource_version`
--


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
-- Dumping data for table `unifiedstorage_migration_log`
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

