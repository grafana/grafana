export var AgentType;
(function (AgentType) {
    AgentType["amazonRdsMysql"] = "amazon_rds_mysql";
    AgentType["container"] = "container";
    AgentType["externalExporter"] = "externalExporter";
    AgentType["generic"] = "generic";
    AgentType["mongodb"] = "mongodb";
    AgentType["mongodbExporter"] = "mongodbExporter";
    AgentType["mysql"] = "mysql";
    AgentType["mysqldExporter"] = "mysqldExporter";
    AgentType["nodeExporter"] = "nodeExporter";
    AgentType["pmmAgent"] = "pmm_agent";
    AgentType["postgresExporter"] = "postgresExporter";
    AgentType["postgresql"] = "postgresql";
    AgentType["proxysql"] = "proxysql";
    AgentType["proxysqlExporter"] = "proxysqlExporter";
    AgentType["qanMongodb_profiler_agent"] = "qan_mongodb_profiler_agent";
    AgentType["qanMysql_perfschema_agent"] = "qan_mysql_perfschema_agent";
    AgentType["qanMysql_slowlog_agent"] = "qan_mysql_slowlog_agent";
    AgentType["qanPostgresql_pgstatements_agent"] = "qan_postgresql_pgstatements_agent";
    AgentType["qanPostgresql_pgstatmonitor_agent"] = "qan_postgresql_pgstatmonitor_agent";
    AgentType["rdsExporter"] = "rdsExporter";
    AgentType["remote"] = "remote";
    AgentType["remote_rds"] = "remote_rds";
    AgentType["vmAgent"] = "vm_agent";
})(AgentType || (AgentType = {}));
export var ServiceAgentStatus;
(function (ServiceAgentStatus) {
    ServiceAgentStatus["STARTING"] = "STARTING";
    ServiceAgentStatus["RUNNING"] = "RUNNING";
    ServiceAgentStatus["WAITING"] = "WAITING";
    ServiceAgentStatus["STOPPING"] = "STOPPING";
    ServiceAgentStatus["DONE"] = "DONE";
    ServiceAgentStatus["UNKNOWN"] = "UNKNOWN";
})(ServiceAgentStatus || (ServiceAgentStatus = {}));
export var MonitoringStatus;
(function (MonitoringStatus) {
    MonitoringStatus["OK"] = "OK";
    MonitoringStatus["FAILED"] = "Failed";
})(MonitoringStatus || (MonitoringStatus = {}));
//# sourceMappingURL=Inventory.types.js.map