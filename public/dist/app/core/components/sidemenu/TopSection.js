import React from 'react';
import _ from 'lodash';
import TopSectionItem from './TopSectionItem';
import config from '../../config';
var TopSection = function () {
    var navTree = _.cloneDeep(config.bootData.navTree);
    var mainLinks = _.filter(navTree, function (item) { return !item.hideFromMenu; });
    return (React.createElement("div", { className: "sidemenu__top" }, mainLinks.map(function (link, index) {
        return React.createElement(TopSectionItem, { link: link, key: link.id + "-" + index });
    })));
};
export default TopSection;
//# sourceMappingURL=TopSection.js.map