/**
 * Represent panel data loading state.
 * @public
 */
export var LoadingState;
(function (LoadingState) {
    LoadingState["NotStarted"] = "NotStarted";
    LoadingState["Loading"] = "Loading";
    LoadingState["Streaming"] = "Streaming";
    LoadingState["Done"] = "Done";
    LoadingState["Error"] = "Error";
})(LoadingState || (LoadingState = {}));
export var NullValueMode;
(function (NullValueMode) {
    NullValueMode["Null"] = "null";
    NullValueMode["Ignore"] = "connected";
    NullValueMode["AsZero"] = "null as zero";
})(NullValueMode || (NullValueMode = {}));
//# sourceMappingURL=data.js.map