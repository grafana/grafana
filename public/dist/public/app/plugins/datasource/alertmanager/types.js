//DOCS: https://prometheus.io/docs/alerting/latest/configuration/
export var SilenceState;
(function (SilenceState) {
    SilenceState["Active"] = "active";
    SilenceState["Expired"] = "expired";
    SilenceState["Pending"] = "pending";
})(SilenceState || (SilenceState = {}));
export var AlertState;
(function (AlertState) {
    AlertState["Unprocessed"] = "unprocessed";
    AlertState["Active"] = "active";
    AlertState["Suppressed"] = "suppressed";
})(AlertState || (AlertState = {}));
export var MatcherOperator;
(function (MatcherOperator) {
    MatcherOperator["equal"] = "=";
    MatcherOperator["notEqual"] = "!=";
    MatcherOperator["regex"] = "=~";
    MatcherOperator["notRegex"] = "!~";
})(MatcherOperator || (MatcherOperator = {}));
export var AlertmanagerChoice;
(function (AlertmanagerChoice) {
    AlertmanagerChoice["Internal"] = "internal";
    AlertmanagerChoice["External"] = "external";
    AlertmanagerChoice["All"] = "all";
})(AlertmanagerChoice || (AlertmanagerChoice = {}));
export var AlertManagerImplementation;
(function (AlertManagerImplementation) {
    AlertManagerImplementation["cortex"] = "cortex";
    AlertManagerImplementation["mimir"] = "mimir";
    AlertManagerImplementation["prometheus"] = "prometheus";
})(AlertManagerImplementation || (AlertManagerImplementation = {}));
//# sourceMappingURL=types.js.map