import { __extends } from "tslib";
import React, { PureComponent } from 'react';
//Services & Utils
import { RICH_HISTORY_SETTING_KEYS, SortOrder } from 'app/core/utils/richHistory';
import store from 'app/core/store';
import { withTheme, TabbedContainer } from '@grafana/ui';
//Components
import { RichHistorySettings } from './RichHistorySettings';
import { RichHistoryQueriesTab } from './RichHistoryQueriesTab';
import { RichHistoryStarredTab } from './RichHistoryStarredTab';
export var Tabs;
(function (Tabs) {
    Tabs["RichHistory"] = "Query history";
    Tabs["Starred"] = "Starred";
    Tabs["Settings"] = "Settings";
})(Tabs || (Tabs = {}));
export var sortOrderOptions = [
    { label: 'Newest first', value: SortOrder.Descending },
    { label: 'Oldest first', value: SortOrder.Ascending },
    { label: 'Data source A-Z', value: SortOrder.DatasourceAZ },
    { label: 'Data source Z-A', value: SortOrder.DatasourceZA },
];
var UnThemedRichHistory = /** @class */ (function (_super) {
    __extends(UnThemedRichHistory, _super);
    function UnThemedRichHistory(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeRetentionPeriod = function (retentionPeriod) {
            if (retentionPeriod.value !== undefined) {
                _this.setState({
                    retentionPeriod: retentionPeriod.value,
                });
                store.set(RICH_HISTORY_SETTING_KEYS.retentionPeriod, retentionPeriod.value);
            }
        };
        _this.toggleStarredTabAsFirstTab = function () {
            var starredTabAsFirstTab = !_this.state.starredTabAsFirstTab;
            _this.setState({
                starredTabAsFirstTab: starredTabAsFirstTab,
            });
            store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, starredTabAsFirstTab);
        };
        _this.toggleActiveDatasourceOnly = function () {
            var activeDatasourceOnly = !_this.state.activeDatasourceOnly;
            _this.setState({
                activeDatasourceOnly: activeDatasourceOnly,
            });
            store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, activeDatasourceOnly);
        };
        _this.onSelectDatasourceFilters = function (value) {
            try {
                store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, value);
            }
            catch (error) {
                console.error(error);
            }
            /* Set data source filters to state even though they were not successfully saved in
             * localStorage to allow interaction and filtering.
             **/
            _this.setState({ datasourceFilters: value });
        };
        _this.onChangeSortOrder = function (sortOrder) { return _this.setState({ sortOrder: sortOrder }); };
        _this.state = {
            sortOrder: SortOrder.Descending,
            datasourceFilters: store.getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, []),
            retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
            starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
            activeDatasourceOnly: store.getBool(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, true),
        };
        return _this;
    }
    /* If user selects activeDatasourceOnly === true, set datasource filter to currently active datasource.
     * Filtering based on datasource won't be available. Otherwise set to null, as filtering will be
     * available for user.
     */
    UnThemedRichHistory.prototype.updateFilters = function () {
        this.state.activeDatasourceOnly && this.props.activeDatasourceInstance
            ? this.onSelectDatasourceFilters([
                { label: this.props.activeDatasourceInstance, value: this.props.activeDatasourceInstance },
            ])
            : this.onSelectDatasourceFilters(this.state.datasourceFilters);
    };
    UnThemedRichHistory.prototype.componentDidMount = function () {
        this.updateFilters();
    };
    UnThemedRichHistory.prototype.componentDidUpdate = function (prevProps, prevState) {
        if (this.props.activeDatasourceInstance !== prevProps.activeDatasourceInstance ||
            this.state.activeDatasourceOnly !== prevState.activeDatasourceOnly) {
            this.updateFilters();
        }
    };
    UnThemedRichHistory.prototype.render = function () {
        var _a = this.state, datasourceFilters = _a.datasourceFilters, sortOrder = _a.sortOrder, activeDatasourceOnly = _a.activeDatasourceOnly, retentionPeriod = _a.retentionPeriod;
        var _b = this.props, richHistory = _b.richHistory, height = _b.height, exploreId = _b.exploreId, deleteRichHistory = _b.deleteRichHistory, onClose = _b.onClose, firstTab = _b.firstTab;
        var QueriesTab = {
            label: 'Query history',
            value: Tabs.RichHistory,
            content: (React.createElement(RichHistoryQueriesTab, { queries: richHistory, sortOrder: sortOrder, datasourceFilters: datasourceFilters, activeDatasourceOnly: activeDatasourceOnly, retentionPeriod: retentionPeriod, onChangeSortOrder: this.onChangeSortOrder, onSelectDatasourceFilters: this.onSelectDatasourceFilters, exploreId: exploreId, height: height })),
            icon: 'history',
        };
        var StarredTab = {
            label: 'Starred',
            value: Tabs.Starred,
            content: (React.createElement(RichHistoryStarredTab, { queries: richHistory, sortOrder: sortOrder, datasourceFilters: datasourceFilters, activeDatasourceOnly: activeDatasourceOnly, onChangeSortOrder: this.onChangeSortOrder, onSelectDatasourceFilters: this.onSelectDatasourceFilters, exploreId: exploreId })),
            icon: 'star',
        };
        var SettingsTab = {
            label: 'Settings',
            value: Tabs.Settings,
            content: (React.createElement(RichHistorySettings, { retentionPeriod: this.state.retentionPeriod, starredTabAsFirstTab: this.state.starredTabAsFirstTab, activeDatasourceOnly: this.state.activeDatasourceOnly, onChangeRetentionPeriod: this.onChangeRetentionPeriod, toggleStarredTabAsFirstTab: this.toggleStarredTabAsFirstTab, toggleactiveDatasourceOnly: this.toggleActiveDatasourceOnly, deleteRichHistory: deleteRichHistory })),
            icon: 'sliders-v-alt',
        };
        var tabs = [QueriesTab, StarredTab, SettingsTab];
        return (React.createElement(TabbedContainer, { tabs: tabs, onClose: onClose, defaultTab: firstTab, closeIconTooltip: "Close query history" }));
    };
    return UnThemedRichHistory;
}(PureComponent));
export var RichHistory = withTheme(UnThemedRichHistory);
//# sourceMappingURL=RichHistory.js.map