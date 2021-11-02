/**
 * Set of handlers for secure password field in Angular components. They handle backward compatibility with
 * passwords stored in plain text fields.
 */
export var PasswordFieldEnum;
(function (PasswordFieldEnum) {
    PasswordFieldEnum["Password"] = "password";
    PasswordFieldEnum["BasicAuthPassword"] = "basicAuthPassword";
})(PasswordFieldEnum || (PasswordFieldEnum = {}));
export var createResetHandler = function (ctrl, field) { return function (event) {
    event.preventDefault();
    // Reset also normal plain text password to remove it and only save it in secureJsonData.
    ctrl.current[field] = undefined;
    ctrl.current.secureJsonFields[field] = false;
    ctrl.current.secureJsonData = ctrl.current.secureJsonData || {};
    ctrl.current.secureJsonData[field] = '';
}; };
export var createChangeHandler = function (ctrl, field) { return function (event) {
    ctrl.current.secureJsonData = ctrl.current.secureJsonData || {};
    ctrl.current.secureJsonData[field] = event.currentTarget.value;
}; };
//# sourceMappingURL=passwordHandlers.js.map