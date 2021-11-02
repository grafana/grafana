import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import React, { useMemo } from 'react';
import { isCloudRulesSource } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';
export function RuleDetailsDataSources(props) {
    var rulesSource = props.rulesSource, rule = props.rule;
    var styles = useStyles2(getStyles);
    var dataSources = useMemo(function () {
        if (isCloudRulesSource(rulesSource)) {
            return [{ name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
        }
        if (isGrafanaRulerRule(rule.rulerRule)) {
            var data = rule.rulerRule.grafana_alert.data;
            var unique = data.reduce(function (dataSources, query) {
                var ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
                if (!ds || ds.uid === ExpressionDatasourceUID) {
                    return dataSources;
                }
                dataSources[ds.name] = { name: ds.name, icon: ds.meta.info.logos.small };
                return dataSources;
            }, {});
            return Object.values(unique);
        }
        return [];
    }, [rule, rulesSource]);
    if (dataSources.length === 0) {
        return null;
    }
    return (React.createElement(DetailsField, { label: "Data source" }, dataSources.map(function (_a, index) {
        var name = _a.name, icon = _a.icon;
        return (React.createElement("div", { key: name },
            icon && (React.createElement(React.Fragment, null,
                React.createElement("img", { className: styles.dataSourceIcon, src: icon }),
                ' ')),
            name));
    })));
}
function getStyles(theme) {
    var size = theme.spacing(2);
    return {
        dataSourceIcon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: ", ";\n      height: ", ";\n    "], ["\n      width: ", ";\n      height: ", ";\n    "])), size, size),
    };
}
var templateObject_1;
//# sourceMappingURL=RuleDetailsDataSources.js.map