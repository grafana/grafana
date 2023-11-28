export var ServiceType;
(function (ServiceType) {
    ServiceType["invalid"] = "SERVICE_TYPE_INVALID";
    ServiceType["mysql"] = "MYSQL_SERVICE";
    ServiceType["mongodb"] = "MONGODB_SERVICE";
    ServiceType["posgresql"] = "POSTGRESQL_SERVICE";
    ServiceType["proxysql"] = "PROXYSQL_SERVICE";
    ServiceType["haproxy"] = "HAPROXY_SERVICE";
    ServiceType["external"] = "EXTERNAL_SERVICE";
})(ServiceType || (ServiceType = {}));
export var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus["UP"] = "UP";
    ServiceStatus["DOWN"] = "DOWN";
    ServiceStatus["UNKNOWN"] = "UNKNOWN";
    ServiceStatus["NA"] = "N/A";
})(ServiceStatus || (ServiceStatus = {}));
//# sourceMappingURL=Services.types.js.map