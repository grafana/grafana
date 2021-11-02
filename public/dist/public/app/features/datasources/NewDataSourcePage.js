import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Button, LinkButton, List, PluginSignatureBadge, FilterInput } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import Page from 'app/core/components/Page/Page';
import { addDataSource, loadDataSourcePlugins } from './state/actions';
import { getDataSourcePlugins } from './state/selectors';
import { setDataSourceTypeSearchQuery } from './state/reducers';
import { Card } from 'app/core/components/Card/Card';
import { PluginsErrorsInfo } from '../plugins/PluginsErrorsInfo';
function mapStateToProps(state) {
    return {
        navModel: getNavModel(),
        plugins: getDataSourcePlugins(state.dataSources),
        searchQuery: state.dataSources.dataSourceTypeSearchQuery,
        categories: state.dataSources.categories,
        isLoading: state.dataSources.isLoadingDataSources,
    };
}
var mapDispatchToProps = {
    addDataSource: addDataSource,
    loadDataSourcePlugins: loadDataSourcePlugins,
    setDataSourceTypeSearchQuery: setDataSourceTypeSearchQuery,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var NewDataSourcePage = /** @class */ (function (_super) {
    __extends(NewDataSourcePage, _super);
    function NewDataSourcePage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onDataSourceTypeClicked = function (plugin) {
            _this.props.addDataSource(plugin);
        };
        _this.onSearchQueryChange = function (value) {
            _this.props.setDataSourceTypeSearchQuery(value);
        };
        _this.onLearnMoreClick = function (evt) {
            evt.stopPropagation();
        };
        return _this;
    }
    NewDataSourcePage.prototype.componentDidMount = function () {
        this.props.loadDataSourcePlugins();
    };
    NewDataSourcePage.prototype.renderPlugins = function (plugins) {
        var _this = this;
        if (!plugins || !plugins.length) {
            return null;
        }
        return (React.createElement(List, { items: plugins, getItemKey: function (item) { return item.id.toString(); }, renderItem: function (item) { return (React.createElement(DataSourceTypeCard, { plugin: item, onClick: function () { return _this.onDataSourceTypeClicked(item); }, onLearnMoreClick: _this.onLearnMoreClick })); } }));
    };
    NewDataSourcePage.prototype.renderCategories = function () {
        var _this = this;
        var categories = this.props.categories;
        return (React.createElement(React.Fragment, null,
            categories.map(function (category) { return (React.createElement("div", { className: "add-data-source-category", key: category.id },
                React.createElement("div", { className: "add-data-source-category__header" }, category.title),
                _this.renderPlugins(category.plugins))); }),
            React.createElement("div", { className: "add-data-source-more" },
                React.createElement(LinkButton, { variant: "secondary", href: "https://grafana.com/plugins?type=datasource&utm_source=grafana_add_ds", target: "_blank", rel: "noopener" }, "Find more data source plugins on grafana.com"))));
    };
    NewDataSourcePage.prototype.render = function () {
        var _a = this.props, navModel = _a.navModel, isLoading = _a.isLoading, searchQuery = _a.searchQuery, plugins = _a.plugins;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement(FilterInput, { value: searchQuery, onChange: this.onSearchQueryChange, placeholder: "Filter by name or type" }),
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement(LinkButton, { href: "datasources", fill: "outline", variant: "secondary", icon: "arrow-left" }, "Cancel")),
                !searchQuery && React.createElement(PluginsErrorsInfo, null),
                React.createElement("div", null,
                    searchQuery && this.renderPlugins(plugins),
                    !searchQuery && this.renderCategories()))));
    };
    return NewDataSourcePage;
}(PureComponent));
var DataSourceTypeCard = function (props) {
    var _a, _b;
    var plugin = props.plugin, onLearnMoreClick = props.onLearnMoreClick;
    var isPhantom = plugin.module === 'phantom';
    var onClick = !isPhantom && !plugin.unlicensed ? props.onClick : function () { };
    // find first plugin info link
    var learnMoreLink = ((_b = (_a = plugin.info) === null || _a === void 0 ? void 0 : _a.links) === null || _b === void 0 ? void 0 : _b.length) > 0 ? plugin.info.links[0] : null;
    return (React.createElement(Card, { title: plugin.name, description: plugin.info.description, ariaLabel: selectors.pages.AddDataSource.dataSourcePlugins(plugin.name), logoUrl: plugin.info.logos.small, actions: React.createElement(React.Fragment, null,
            learnMoreLink && (React.createElement(LinkButton, { variant: "secondary", href: learnMoreLink.url + "?utm_source=grafana_add_ds", target: "_blank", rel: "noopener", onClick: onLearnMoreClick, icon: "external-link-alt" }, learnMoreLink.name)),
            !isPhantom && React.createElement(Button, { disabled: plugin.unlicensed }, "Select")), labels: !isPhantom && React.createElement(PluginSignatureBadge, { status: plugin.signature }), className: isPhantom ? 'add-data-source-item--phantom' : '', onClick: onClick, "aria-label": selectors.pages.AddDataSource.dataSourcePlugins(plugin.name) }));
};
export function getNavModel() {
    var main = {
        icon: 'database',
        id: 'datasource-new',
        text: 'Add data source',
        href: 'datasources/new',
        subTitle: 'Choose a data source type',
    };
    return {
        main: main,
        node: main,
    };
}
export default connector(NewDataSourcePage);
//# sourceMappingURL=NewDataSourcePage.js.map