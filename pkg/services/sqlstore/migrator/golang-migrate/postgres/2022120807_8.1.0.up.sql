-- add index library_element_connection element_id-kind-connection_id
CREATE UNIQUE INDEX "UQE_library_element_connection_element_id_kind_connection_id" ON "library_element_connection" ("element_id","kind","connection_id");
-- alert alert_configuration alertmanager_configuration column from TEXT to MEDIUMTEXT if mysql
SELECT 0;
