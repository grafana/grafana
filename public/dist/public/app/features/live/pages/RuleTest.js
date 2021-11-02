import { __makeTemplateObject, __read, __values } from "tslib";
import React, { useState } from 'react';
import { Button, CodeEditor, Table, useStyles, Field } from '@grafana/ui';
import { getBackendSrv, config } from '@grafana/runtime';
import { css } from '@emotion/css';
import { getDisplayProcessor, StreamingDataFrame } from '@grafana/data';
export var RuleTest = function (props) {
    var _a = __read(useState(), 2), response = _a[0], setResponse = _a[1];
    var _b = __read(useState(), 2), data = _b[0], setData = _b[1];
    var styles = useStyles(getStyles);
    var onBlur = function (text) {
        setData(text);
    };
    var onClick = function () {
        getBackendSrv()
            .post("api/live/pipeline-convert-test", {
            channelRules: [props.rule],
            channel: props.rule.pattern,
            data: data,
        })
            .then(function (data) {
            var t = data.channelFrames;
            if (t) {
                setResponse(t.map(function (f) {
                    var e_1, _a;
                    var frame = new StreamingDataFrame(f.frame);
                    try {
                        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var field = _c.value;
                            field.display = getDisplayProcessor({ field: field, theme: config.theme2 });
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return { channel: f.channel, frame: frame };
                }));
            }
        })
            .catch(function (e) {
            setResponse(e);
        });
    };
    return (React.createElement("div", null,
        React.createElement(CodeEditor, { height: 100, value: "", showLineNumbers: true, readOnly: false, language: "json", showMiniMap: false, onBlur: onBlur }),
        React.createElement(Button, { onClick: onClick, className: styles.margin }, "Test"),
        (response === null || response === void 0 ? void 0 : response.length) &&
            response.map(function (r) { return (React.createElement(Field, { key: r.channel, label: r.channel },
                React.createElement(Table, { data: r.frame, width: 700, height: Math.min(10 * r.frame.length + 10, 150), showTypeIcons: true }))); })));
};
var getStyles = function (theme) {
    return {
        margin: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: 15px;\n    "], ["\n      margin-bottom: 15px;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=RuleTest.js.map