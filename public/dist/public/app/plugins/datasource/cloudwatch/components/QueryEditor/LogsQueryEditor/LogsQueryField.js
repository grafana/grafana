import React, { useCallback } from 'react';
import { CodeEditor, withTheme2 } from '@grafana/ui';
import language from '../../../language/logs/definition';
import { TRIGGER_SUGGEST } from '../../../language/monarch/commands';
import { registerLanguage } from '../../../language/monarch/register';
import { getStatsGroups } from '../../../utils/query/getStatsGroups';
import { LogGroupsFieldWrapper } from '../../shared/LogGroups/LogGroupsField';
export const CloudWatchLogsQueryFieldMonaco = (props) => {
    var _a, _b, _c;
    const { query, datasource, onChange, ExtraFieldElement, data } = props;
    const showError = ((_a = data === null || data === void 0 ? void 0 : data.error) === null || _a === void 0 ? void 0 : _a.refId) === query.refId;
    const onChangeQuery = useCallback((value) => {
        const nextQuery = Object.assign(Object.assign({}, query), { expression: value, statsGroups: getStatsGroups(value) });
        onChange(nextQuery);
    }, [onChange, query]);
    const onEditorMount = useCallback((editor, monaco) => {
        editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            const text = editor.getValue();
            onChangeQuery(text);
        });
    }, [onChangeQuery]);
    return (React.createElement(React.Fragment, null,
        React.createElement(LogGroupsFieldWrapper, { region: query.region, datasource: datasource, legacyLogGroupNames: query.logGroupNames, logGroups: query.logGroups, onChange: (logGroups) => {
                onChange(Object.assign(Object.assign({}, query), { logGroups, logGroupNames: undefined }));
            }, 
            //legacy props
            legacyOnChange: (logGroupNames) => {
                onChange(Object.assign(Object.assign({}, query), { logGroupNames }));
            } }),
        React.createElement("div", { className: "gf-form-inline gf-form-inline--nowrap flex-grow-1" },
            React.createElement("div", { className: "gf-form--grow flex-shrink-1" },
                React.createElement(CodeEditor, { height: "150px", width: "100%", showMiniMap: false, monacoOptions: {
                        // without this setting, the auto-resize functionality causes an infinite loop, don't remove it!
                        scrollBeyondLastLine: false,
                        // These additional options are style focused and are a subset of those in the query editor in Prometheus
                        fontSize: 14,
                        lineNumbers: 'off',
                        renderLineHighlight: 'none',
                        scrollbar: {
                            vertical: 'hidden',
                            horizontal: 'hidden',
                        },
                        suggestFontSize: 12,
                        wordWrap: 'on',
                        padding: {
                            top: 6,
                        },
                    }, language: language.id, value: (_b = query.expression) !== null && _b !== void 0 ? _b : '', onBlur: (value) => {
                        if (value !== query.expression) {
                            onChangeQuery(value);
                        }
                    }, onBeforeEditorMount: (monaco) => registerLanguage(monaco, language, datasource.logsCompletionItemProvider), onEditorDidMount: onEditorMount })),
            ExtraFieldElement),
        showError ? (React.createElement("div", { className: "query-row-break" },
            React.createElement("div", { className: "prom-query-field-info text-error" }, (_c = data === null || data === void 0 ? void 0 : data.error) === null || _c === void 0 ? void 0 : _c.message))) : null));
};
export default withTheme2(CloudWatchLogsQueryFieldMonaco);
//# sourceMappingURL=LogsQueryField.js.map