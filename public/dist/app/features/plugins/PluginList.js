import React from 'react';
import classNames from 'classnames';
import PluginListItem from './PluginListItem';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
var PluginList = function (props) {
    var plugins = props.plugins, layoutMode = props.layoutMode;
    var listStyle = classNames({
        'card-section': true,
        'card-list-layout-grid': layoutMode === LayoutModes.Grid,
        'card-list-layout-list': layoutMode === LayoutModes.List,
    });
    return (React.createElement("section", { className: listStyle },
        React.createElement("ol", { className: "card-list" }, plugins.map(function (plugin, index) {
            return React.createElement(PluginListItem, { plugin: plugin, key: plugin.name + "-" + index });
        }))));
};
export default PluginList;
//# sourceMappingURL=PluginList.js.map