import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Input } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { PipelineTable } from './PipelineTable';
import { AddNewRule } from './AddNewRule';
export default function PipelineAdminPage() {
    var _a = __read(useState([]), 2), rules = _a[0], setRules = _a[1];
    var _b = __read(useState([]), 2), defaultRules = _b[0], setDefaultRules = _b[1];
    var _c = __read(useState(), 2), newRule = _c[0], setNewRule = _c[1];
    var navModel = useNavModel('live-pipeline');
    var _d = __read(useState(), 2), error = _d[0], setError = _d[1];
    var loadRules = function () {
        getBackendSrv()
            .get("api/live/channel-rules")
            .then(function (data) {
            var _a, _b;
            setRules((_a = data.rules) !== null && _a !== void 0 ? _a : []);
            setDefaultRules((_b = data.rules) !== null && _b !== void 0 ? _b : []);
        })
            .catch(function (e) {
            if (e.data) {
                setError(JSON.stringify(e.data, null, 2));
            }
        });
    };
    useEffect(function () {
        loadRules();
    }, []);
    var onSearchQueryChange = function (e) {
        if (e.target.value) {
            setRules(rules.filter(function (rule) { return rule.pattern.toLowerCase().includes(e.target.value.toLowerCase()); }));
        }
        else {
            setRules(defaultRules);
        }
    };
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            error && React.createElement("pre", null, error),
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(Input, { placeholder: "Search pattern...", onChange: onSearchQueryChange }))),
            React.createElement(PipelineTable, { rules: rules, onRuleChanged: loadRules, selectRule: newRule }),
            React.createElement(AddNewRule, { onRuleAdded: function (r) {
                    console.log('GOT', r, 'vs', rules[0]);
                    setNewRule(r);
                    loadRules();
                } }))));
}
//# sourceMappingURL=PipelineAdminPage.js.map