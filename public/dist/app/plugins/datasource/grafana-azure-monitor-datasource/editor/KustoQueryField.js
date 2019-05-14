import * as tslib_1 from "tslib";
import _ from 'lodash';
import Plain from 'slate-plain-serializer';
import QueryField from './query_field';
// import debounce from './utils/debounce';
// import {getNextCharacter} from './utils/dom';
import debounce from 'app/features/explore/utils/debounce';
import { getNextCharacter } from 'app/features/explore/utils/dom';
import { KEYWORDS, functionTokens, operatorTokens, grafanaMacros } from './kusto/kusto';
// import '../sass/editor.base.scss';
var TYPEAHEAD_DELAY = 100;
var defaultSchema = function () { return ({
    Databases: {
        Default: {},
    },
}); };
var cleanText = function (s) { return s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim(); };
var wrapText = function (text) { return ({ text: text }); };
var KustoQueryField = /** @class */ (function (_super) {
    tslib_1.__extends(KustoQueryField, _super);
    function KustoQueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.onTypeahead = function (force) {
            var selection = window.getSelection();
            if (selection.anchorNode) {
                var wrapperNode = selection.anchorNode.parentElement;
                if (wrapperNode === null) {
                    return;
                }
                var editorNode = wrapperNode.closest('.slate-query-field');
                if (!editorNode || _this.state.value.isBlurred) {
                    // Not inside this editor
                    return;
                }
                // DOM ranges
                var range = selection.getRangeAt(0);
                var text = selection.anchorNode.textContent;
                if (text === null) {
                    return;
                }
                var offset = range.startOffset;
                var prefix_1 = cleanText(text.substr(0, offset));
                // Model ranges
                var modelOffset = _this.state.value.anchorOffset;
                var modelPrefix = _this.state.value.anchorText.text.slice(0, modelOffset);
                // Determine candidates by context
                var suggestionGroups = [];
                var wrapperClasses = wrapperNode.classList;
                var typeaheadContext = null;
                // Built-in functions
                if (wrapperClasses.contains('function-context')) {
                    typeaheadContext = 'context-function';
                    suggestionGroups = _this.getColumnSuggestions();
                    // where
                }
                else if (modelPrefix.match(/(where\s(\w+\b)?$)/i)) {
                    typeaheadContext = 'context-where';
                    suggestionGroups = _this.getColumnSuggestions();
                    // summarize by
                }
                else if (modelPrefix.match(/(summarize\s(\w+\b)?$)/i)) {
                    typeaheadContext = 'context-summarize';
                    suggestionGroups = _this.getFunctionSuggestions();
                }
                else if (modelPrefix.match(/(summarize\s(.+\s)?by\s+([^,\s]+,\s*)*([^,\s]+\b)?$)/i)) {
                    typeaheadContext = 'context-summarize-by';
                    suggestionGroups = _this.getColumnSuggestions();
                    // order by, top X by, ... by ...
                }
                else if (modelPrefix.match(/(by\s+([^,\s]+,\s*)*([^,\s]+\b)?$)/i)) {
                    typeaheadContext = 'context-by';
                    suggestionGroups = _this.getColumnSuggestions();
                    // join
                }
                else if (modelPrefix.match(/(on\s(.+\b)?$)/i)) {
                    typeaheadContext = 'context-join-on';
                    suggestionGroups = _this.getColumnSuggestions();
                }
                else if (modelPrefix.match(/(join\s+(\(\s+)?(\w+\b)?$)/i)) {
                    typeaheadContext = 'context-join';
                    suggestionGroups = _this.getTableSuggestions();
                    // distinct
                }
                else if (modelPrefix.match(/(distinct\s(.+\b)?$)/i)) {
                    typeaheadContext = 'context-distinct';
                    suggestionGroups = _this.getColumnSuggestions();
                    // database()
                }
                else if (modelPrefix.match(/(database\(\"(\w+)\"\)\.(.+\b)?$)/i)) {
                    typeaheadContext = 'context-database-table';
                    var db = _this.getDBFromDatabaseFunction(modelPrefix);
                    console.log(db);
                    suggestionGroups = _this.getTableSuggestions(db);
                    prefix_1 = prefix_1.replace('.', '');
                    // new
                }
                else if (normalizeQuery(Plain.serialize(_this.state.value)).match(/^\s*\w*$/i)) {
                    typeaheadContext = 'context-new';
                    if (_this.schema) {
                        suggestionGroups = _this.getInitialSuggestions();
                    }
                    else {
                        _this.fetchSchema();
                        setTimeout(_this.onTypeahead, 0);
                        return;
                    }
                    // built-in
                }
                else if (prefix_1 && !wrapperClasses.contains('argument') && !force) {
                    // Use only last typed word as a prefix for searching
                    if (modelPrefix.match(/\s$/i)) {
                        prefix_1 = '';
                        return;
                    }
                    prefix_1 = getLastWord(prefix_1);
                    typeaheadContext = 'context-builtin';
                    suggestionGroups = _this.getKeywordSuggestions();
                }
                else if (force === true) {
                    typeaheadContext = 'context-builtin-forced';
                    if (modelPrefix.match(/\s$/i)) {
                        prefix_1 = '';
                    }
                    suggestionGroups = _this.getKeywordSuggestions();
                }
                var results_1 = 0;
                prefix_1 = prefix_1.toLowerCase();
                var filteredSuggestions = suggestionGroups
                    .map(function (group) {
                    if (group.items && prefix_1 && !group.skipFilter) {
                        group.items = group.items.filter(function (c) { return c.text.length >= prefix_1.length; });
                        if (group.prefixMatch) {
                            group.items = group.items.filter(function (c) { return c.text.toLowerCase().indexOf(prefix_1) === 0; });
                        }
                        else {
                            group.items = group.items.filter(function (c) { return c.text.toLowerCase().indexOf(prefix_1) > -1; });
                        }
                    }
                    results_1 += group.items.length;
                    return group;
                })
                    .filter(function (group) { return group.items.length > 0; });
                // console.log('onTypeahead', selection.anchorNode, wrapperClasses, text, offset, prefix, typeaheadContext);
                // console.log('onTypeahead', prefix, typeaheadContext, force);
                _this.setState({
                    typeaheadPrefix: prefix_1,
                    typeaheadContext: typeaheadContext,
                    typeaheadText: text,
                    suggestions: results_1 > 0 ? filteredSuggestions : [],
                });
            }
        };
        _this.schema = defaultSchema();
        _this.onTypeahead = debounce(_this.onTypeahead, TYPEAHEAD_DELAY);
        return _this;
    }
    KustoQueryField.prototype.componentDidMount = function () {
        _super.prototype.componentDidMount.call(this);
        this.fetchSchema();
    };
    KustoQueryField.prototype.applyTypeahead = function (change, suggestion) {
        var _a = this.state, typeaheadPrefix = _a.typeaheadPrefix, typeaheadContext = _a.typeaheadContext, typeaheadText = _a.typeaheadText;
        var suggestionText = suggestion.text || suggestion;
        var move = 0;
        // Modify suggestion based on context
        var nextChar = getNextCharacter();
        if (suggestion.type === 'function') {
            if (!nextChar || nextChar !== '(') {
                suggestionText += '(';
            }
        }
        else if (typeaheadContext === 'context-function') {
            if (!nextChar || nextChar !== ')') {
                suggestionText += ')';
            }
        }
        else {
            if (!nextChar || nextChar !== ' ') {
                suggestionText += ' ';
            }
        }
        this.resetTypeahead();
        // Remove the current, incomplete text and replace it with the selected suggestion
        var backward = suggestion.deleteBackwards || typeaheadPrefix.length;
        var text = cleanText(typeaheadText);
        var suffixLength = text.length - typeaheadPrefix.length;
        var offset = typeaheadText.indexOf(typeaheadPrefix);
        var midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
        var forward = midWord ? suffixLength + offset : 0;
        return change
            .deleteBackward(backward)
            .deleteForward(forward)
            .insertText(suggestionText)
            .move(move)
            .focus();
    };
    // private _getFieldsSuggestions(): SuggestionGroup[] {
    //   return [
    //     {
    //       prefixMatch: true,
    //       label: 'Fields',
    //       items: this.fields.map(wrapText)
    //     },
    //     {
    //       prefixMatch: true,
    //       label: 'Variables',
    //       items: this.props.templateVariables.map(wrapText)
    //     }
    //   ];
    // }
    // private _getAfterFromSuggestions(): SuggestionGroup[] {
    //   return [
    //     {
    //       skipFilter: true,
    //       label: 'Events',
    //       items: this.events.map(wrapText)
    //     },
    //     {
    //       prefixMatch: true,
    //       label: 'Variables',
    //       items: this.props.templateVariables
    //         .map(wrapText)
    //         .map(suggestion => {
    //           suggestion.deleteBackwards = 0;
    //           return suggestion;
    //         })
    //     }
    //   ];
    // }
    // private _getAfterSelectSuggestions(): SuggestionGroup[] {
    //   return [
    //     {
    //       prefixMatch: true,
    //       label: 'Fields',
    //       items: this.fields.map(wrapText)
    //     },
    //     {
    //       prefixMatch: true,
    //       label: 'Functions',
    //       items: FUNCTIONS.map((s: any) => { s.type = 'function'; return s; })
    //     },
    //     {
    //       prefixMatch: true,
    //       label: 'Variables',
    //       items: this.props.templateVariables.map(wrapText)
    //     }
    //   ];
    // }
    KustoQueryField.prototype.getInitialSuggestions = function () {
        return this.getTableSuggestions();
    };
    KustoQueryField.prototype.getKeywordSuggestions = function () {
        return [
            {
                prefixMatch: true,
                label: 'Keywords',
                items: KEYWORDS.map(wrapText),
            },
            {
                prefixMatch: true,
                label: 'Operators',
                items: operatorTokens,
            },
            {
                prefixMatch: true,
                label: 'Functions',
                items: functionTokens.map(function (s) {
                    s.type = 'function';
                    return s;
                }),
            },
            {
                prefixMatch: true,
                label: 'Macros',
                items: grafanaMacros.map(function (s) {
                    s.type = 'function';
                    return s;
                }),
            },
            {
                prefixMatch: true,
                label: 'Tables',
                items: _.map(this.schema.Databases.Default.Tables, function (t) { return ({ text: t.Name }); }),
            },
        ];
    };
    KustoQueryField.prototype.getFunctionSuggestions = function () {
        return [
            {
                prefixMatch: true,
                label: 'Functions',
                items: functionTokens.map(function (s) {
                    s.type = 'function';
                    return s;
                }),
            },
            {
                prefixMatch: true,
                label: 'Macros',
                items: grafanaMacros.map(function (s) {
                    s.type = 'function';
                    return s;
                }),
            },
        ];
    };
    KustoQueryField.prototype.getTableSuggestions = function (db) {
        if (db === void 0) { db = 'Default'; }
        if (this.schema.Databases[db]) {
            return [
                {
                    prefixMatch: true,
                    label: 'Tables',
                    items: _.map(this.schema.Databases[db].Tables, function (t) { return ({ text: t.Name }); }),
                },
            ];
        }
        else {
            return [];
        }
    };
    KustoQueryField.prototype.getColumnSuggestions = function () {
        var table = this.getTableFromContext();
        if (table) {
            var tableSchema = this.schema.Databases.Default.Tables[table];
            if (tableSchema) {
                return [
                    {
                        prefixMatch: true,
                        label: 'Fields',
                        items: _.map(tableSchema.OrderedColumns, function (f) { return ({
                            text: f.Name,
                            hint: f.Type,
                        }); }),
                    },
                ];
            }
        }
        return [];
    };
    KustoQueryField.prototype.getTableFromContext = function () {
        var query = Plain.serialize(this.state.value);
        var tablePattern = /^\s*(\w+)\s*|/g;
        var normalizedQuery = normalizeQuery(query);
        var match = tablePattern.exec(normalizedQuery);
        if (match && match.length > 1 && match[0] && match[1]) {
            return match[1];
        }
        else {
            return null;
        }
    };
    KustoQueryField.prototype.getDBFromDatabaseFunction = function (prefix) {
        var databasePattern = /database\(\"(\w+)\"\)/gi;
        var match = databasePattern.exec(prefix);
        if (match && match.length > 1 && match[0] && match[1]) {
            return match[1];
        }
        else {
            return null;
        }
    };
    KustoQueryField.prototype.fetchSchema = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var schema;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.getSchema()];
                    case 1:
                        schema = _a.sent();
                        if (schema) {
                            if (schema.Type === 'AppInsights') {
                                schema = castSchema(schema);
                            }
                            this.schema = schema;
                        }
                        else {
                            this.schema = defaultSchema();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return KustoQueryField;
}(QueryField));
export default KustoQueryField;
/**
 * Cast schema from App Insights to default Kusto schema
 */
function castSchema(schema) {
    var defaultSchemaTemplate = defaultSchema();
    defaultSchemaTemplate.Databases.Default = schema;
    return defaultSchemaTemplate;
}
function normalizeQuery(query) {
    var commentPattern = /\/\/.*$/gm;
    var normalizedQuery = query.replace(commentPattern, '');
    normalizedQuery = normalizedQuery.replace('\n', ' ');
    return normalizedQuery;
}
function getLastWord(str) {
    var lastWordPattern = /(?:.*\s)?([^\s]+\s*)$/gi;
    var match = lastWordPattern.exec(str);
    if (match && match.length > 1) {
        return match[1];
    }
    return '';
}
//# sourceMappingURL=KustoQueryField.js.map