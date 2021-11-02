// This needs to be in its own file to avoid circular references
// Builtin Predicates
// not using 'any' and 'never' since they are reserved keywords
export var MatcherID;
(function (MatcherID) {
    MatcherID["anyMatch"] = "anyMatch";
    MatcherID["allMatch"] = "allMatch";
    MatcherID["invertMatch"] = "invertMatch";
    MatcherID["alwaysMatch"] = "alwaysMatch";
    MatcherID["neverMatch"] = "neverMatch";
})(MatcherID || (MatcherID = {}));
export var FieldMatcherID;
(function (FieldMatcherID) {
    // Specific Types
    FieldMatcherID["numeric"] = "numeric";
    FieldMatcherID["time"] = "time";
    FieldMatcherID["first"] = "first";
    FieldMatcherID["firstTimeField"] = "firstTimeField";
    // With arguments
    FieldMatcherID["byType"] = "byType";
    FieldMatcherID["byName"] = "byName";
    FieldMatcherID["byNames"] = "byNames";
    FieldMatcherID["byRegexp"] = "byRegexp";
    FieldMatcherID["byRegexpOrNames"] = "byRegexpOrNames";
    FieldMatcherID["byFrameRefID"] = "byFrameRefID";
    // byIndex = 'byIndex',
    // byLabel = 'byLabel',
})(FieldMatcherID || (FieldMatcherID = {}));
/**
 * Field name matchers
 */
export var FrameMatcherID;
(function (FrameMatcherID) {
    FrameMatcherID["byName"] = "byName";
    FrameMatcherID["byRefId"] = "byRefId";
    FrameMatcherID["byIndex"] = "byIndex";
    FrameMatcherID["byLabel"] = "byLabel";
})(FrameMatcherID || (FrameMatcherID = {}));
/**
 * @public
 */
export var ValueMatcherID;
(function (ValueMatcherID) {
    ValueMatcherID["regex"] = "regex";
    ValueMatcherID["isNull"] = "isNull";
    ValueMatcherID["isNotNull"] = "isNotNull";
    ValueMatcherID["greater"] = "greater";
    ValueMatcherID["greaterOrEqual"] = "greaterOrEqual";
    ValueMatcherID["lower"] = "lower";
    ValueMatcherID["lowerOrEqual"] = "lowerOrEqual";
    ValueMatcherID["equal"] = "equal";
    ValueMatcherID["notEqual"] = "notEqual";
    ValueMatcherID["between"] = "between";
})(ValueMatcherID || (ValueMatcherID = {}));
//# sourceMappingURL=ids.js.map