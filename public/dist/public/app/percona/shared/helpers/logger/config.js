// eslint-disable-next-line no-shadow
export var LOG_LEVELS;
(function (LOG_LEVELS) {
    // this will log everything
    LOG_LEVELS[LOG_LEVELS["DEBUG"] = 0] = "DEBUG";
    LOG_LEVELS[LOG_LEVELS["LOG"] = 1] = "LOG";
    LOG_LEVELS[LOG_LEVELS["INFO"] = 2] = "INFO";
    LOG_LEVELS[LOG_LEVELS["WARN"] = 3] = "WARN";
    // this will only log errors
    LOG_LEVELS[LOG_LEVELS["ERROR"] = 4] = "ERROR";
    // this will silence the logger (mainly used in tests)
    LOG_LEVELS[LOG_LEVELS["NONE"] = 5] = "NONE";
})(LOG_LEVELS || (LOG_LEVELS = {}));
//# sourceMappingURL=config.js.map