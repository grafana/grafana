/**
 * Errors are used when the operation on Rich History was not successful.
 */
export var RichHistoryServiceError;
(function (RichHistoryServiceError) {
    RichHistoryServiceError["StorageFull"] = "StorageFull";
    RichHistoryServiceError["DuplicatedEntry"] = "DuplicatedEntry";
})(RichHistoryServiceError || (RichHistoryServiceError = {}));
/**
 * Warnings are used when an entry has been added but there are some side effects that user should be informed about.
 */
export var RichHistoryStorageWarning;
(function (RichHistoryStorageWarning) {
    /**
     * Returned when an entry was successfully added but maximum items limit has been reached and old entries have been removed.
     */
    RichHistoryStorageWarning["LimitExceeded"] = "LimitExceeded";
})(RichHistoryStorageWarning || (RichHistoryStorageWarning = {}));
//# sourceMappingURL=RichHistoryStorage.js.map