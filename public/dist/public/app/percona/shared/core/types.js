export var Databases;
(function (Databases) {
    Databases["postgresql"] = "postgresql";
    Databases["mongodb"] = "mongodb";
    Databases["mysql"] = "mysql";
    Databases["mariadb"] = "mariadb";
    Databases["proxysql"] = "proxysql";
    Databases["haproxy"] = "haproxy";
})(Databases || (Databases = {}));
export var ApiErrorCode;
(function (ApiErrorCode) {
    ApiErrorCode["ERROR_CODE_XTRABACKUP_NOT_INSTALLED"] = "ERROR_CODE_XTRABACKUP_NOT_INSTALLED";
    ApiErrorCode["ERROR_CODE_INVALID_XTRABACKUP"] = "ERROR_CODE_INVALID_XTRABACKUP";
    ApiErrorCode["ERROR_CODE_INCOMPATIBLE_XTRABACKUP"] = "ERROR_CODE_INCOMPATIBLE_XTRABACKUP";
    ApiErrorCode["ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL"] = "ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL";
})(ApiErrorCode || (ApiErrorCode = {}));
export var Severity;
(function (Severity) {
    Severity["SEVERITY_EMERGENCY"] = "Emergency";
    Severity["SEVERITY_ALERT"] = "Alert";
    Severity["SEVERITY_CRITICAL"] = "Critical";
    Severity["SEVERITY_ERROR"] = "Error";
    Severity["SEVERITY_WARNING"] = "Warning";
    Severity["SEVERITY_NOTICE"] = "Notice";
    Severity["SEVERITY_INFO"] = "Info";
    Severity["SEVERITY_DEBUG"] = "Debug";
})(Severity || (Severity = {}));
export var AlertRuleParamType;
(function (AlertRuleParamType) {
    AlertRuleParamType["BOOL"] = "bool";
    AlertRuleParamType["FLOAT"] = "float";
    AlertRuleParamType["STRING"] = "string";
})(AlertRuleParamType || (AlertRuleParamType = {}));
export var AlertRuleFilterType;
(function (AlertRuleFilterType) {
    AlertRuleFilterType["MATCH"] = "MATCH";
    AlertRuleFilterType["MISMATCH"] = "MISMATCH";
})(AlertRuleFilterType || (AlertRuleFilterType = {}));
//# sourceMappingURL=types.js.map