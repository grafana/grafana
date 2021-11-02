import { __makeTemplateObject } from "tslib";
// Libraries
import React from 'react';
import { Card, Tag, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export var DataSourcesList = function (_a) {
    var dataSources = _a.dataSources, layoutMode = _a.layoutMode;
    var styles = useStyles(getStyles);
    return (React.createElement("ul", { className: styles.list }, dataSources.map(function (dataSource, index) {
        return (React.createElement("li", { key: dataSource.id },
            React.createElement(Card, { heading: dataSource.name, href: "datasources/edit/" + dataSource.uid },
                React.createElement(Card.Figure, null,
                    React.createElement("img", { src: dataSource.typeLogoUrl, alt: dataSource.name })),
                React.createElement(Card.Meta, null, [
                    dataSource.typeName,
                    dataSource.url,
                    dataSource.isDefault && React.createElement(Tag, { key: "default-tag", name: 'default', colorIndex: 1 }),
                ]))));
    })));
};
export default DataSourcesList;
var getStyles = function () {
    return {
        list: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      list-style: none;\n    "], ["\n      list-style: none;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=DataSourcesList.js.map