// Avoid writing the warning message more than once every 10s
var history = {};
export var deprecationWarning = function (file, oldName, newName) {
    var message = "[Deprecation warning] " + file + ": " + oldName + " is deprecated";
    if (newName) {
        message += ". Use " + newName + " instead";
    }
    var now = Date.now();
    var last = history[message];
    if (!last || now - last > 10000) {
        console.warn(message);
        history[message] = now;
    }
};
//# sourceMappingURL=deprecationWarning.js.map