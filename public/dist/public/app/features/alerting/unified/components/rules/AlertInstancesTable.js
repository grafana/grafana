import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';
import { DynamicTable } from '../DynamicTable';
export var AlertInstancesTable = function (_a) {
    var instances = _a.instances;
    // add key & sort instance. API returns instances in random order, different every time.
    var items = useMemo(function () {
        return instances
            .map(function (instance) { return ({
            data: instance,
            id: alertInstanceKey(instance),
        }); })
            .sort(function (a, b) { return a.id.localeCompare(b.id); });
    }, [instances]);
    return (React.createElement(DynamicTable, { cols: columns, isExpandable: true, items: items, renderExpandedContent: function (_a) {
            var data = _a.data;
            return React.createElement(AlertInstanceDetails, { instance: data });
        } }));
};
export var getStyles = function (theme) { return ({
    colExpand: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 36px;\n  "], ["\n    width: 36px;\n  "]))),
    colState: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 110px;\n  "], ["\n    width: 110px;\n  "]))),
    labelsCell: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding-top: ", " !important;\n    padding-bottom: ", " !important;\n  "], ["\n    padding-top: ", " !important;\n    padding-bottom: ", " !important;\n  "])), theme.spacing(0.5), theme.spacing(0.5)),
    createdCell: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    white-space: nowrap;\n  "], ["\n    white-space: nowrap;\n  "]))),
    table: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    td {\n      vertical-align: top;\n      padding-top: ", ";\n      padding-bottom: ", ";\n    }\n  "], ["\n    td {\n      vertical-align: top;\n      padding-top: ", ";\n      padding-bottom: ", ";\n    }\n  "])), theme.spacing(1), theme.spacing(1)),
}); };
var columns = [
    {
        id: 'state',
        label: 'State',
        // eslint-disable-next-line react/display-name
        renderCell: function (_a) {
            var state = _a.data.state;
            return React.createElement(AlertStateTag, { state: state });
        },
        size: '80px',
    },
    {
        id: 'labels',
        label: 'Labels',
        // eslint-disable-next-line react/display-name
        renderCell: function (_a) {
            var labels = _a.data.labels;
            return React.createElement(AlertLabels, { labels: labels });
        },
    },
    {
        id: 'created',
        label: 'Created',
        // eslint-disable-next-line react/display-name
        renderCell: function (_a) {
            var activeAt = _a.data.activeAt;
            return (React.createElement(React.Fragment, null, activeAt.startsWith('0001') ? '-' : activeAt.substr(0, 19).replace('T', ' ')));
        },
        size: '150px',
    },
];
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=AlertInstancesTable.js.map