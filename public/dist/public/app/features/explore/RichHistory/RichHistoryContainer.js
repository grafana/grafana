import { __read } from "tslib";
// Libraries
import React, { useState } from 'react';
import { connect } from 'react-redux';
// Services & Utils
import store from 'app/core/store';
import { RICH_HISTORY_SETTING_KEYS } from 'app/core/utils/richHistory';
// Components, enums
import { RichHistory, Tabs } from './RichHistory';
//Actions
import { deleteRichHistory } from '../state/history';
import { ExploreDrawer } from '../ExploreDrawer';
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    // @ts-ignore
    var item = explore[exploreId];
    var datasourceInstance = item.datasourceInstance;
    var firstTab = store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false)
        ? Tabs.Starred
        : Tabs.RichHistory;
    var richHistory = explore.richHistory;
    return {
        richHistory: richHistory,
        firstTab: firstTab,
        activeDatasourceInstance: datasourceInstance === null || datasourceInstance === void 0 ? void 0 : datasourceInstance.name,
    };
}
var mapDispatchToProps = {
    deleteRichHistory: deleteRichHistory,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export function RichHistoryContainer(props) {
    var _a = __read(useState(400), 2), height = _a[0], setHeight = _a[1];
    var richHistory = props.richHistory, width = props.width, firstTab = props.firstTab, activeDatasourceInstance = props.activeDatasourceInstance, exploreId = props.exploreId, deleteRichHistory = props.deleteRichHistory, onClose = props.onClose;
    return (React.createElement(ExploreDrawer, { width: width, onResize: function (_e, _dir, ref) {
            setHeight(Number(ref.style.height.slice(0, -2)));
        } },
        React.createElement(RichHistory, { richHistory: richHistory, firstTab: firstTab, activeDatasourceInstance: activeDatasourceInstance, exploreId: exploreId, deleteRichHistory: deleteRichHistory, onClose: onClose, height: height })));
}
export default connector(RichHistoryContainer);
//# sourceMappingURL=RichHistoryContainer.js.map