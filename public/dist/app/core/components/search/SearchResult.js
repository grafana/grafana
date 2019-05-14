import * as tslib_1 from "tslib";
import React from 'react';
import classNames from 'classnames';
var SearchResult = /** @class */ (function (_super) {
    tslib_1.__extends(SearchResult, _super);
    function SearchResult(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            search: '',
        };
        return _this;
    }
    SearchResult.prototype.render = function () {
        return this.state.search.sections.map(function (section) {
            return React.createElement(SearchResultSection, { section: section, key: section.id });
        });
    };
    return SearchResult;
}(React.Component));
export { SearchResult };
var SearchResultSection = /** @class */ (function (_super) {
    tslib_1.__extends(SearchResultSection, _super);
    function SearchResultSection(props) {
        var _this = _super.call(this, props) || this;
        _this.toggleSection = function () {
            _this.props.section.toggle();
        };
        return _this;
    }
    SearchResultSection.prototype.renderItem = function (item) {
        return (React.createElement("a", { className: "search-item", href: item.url, key: item.id },
            React.createElement("span", { className: "search-item__icon" },
                React.createElement("i", { className: "fa fa-th-large" })),
            React.createElement("span", { className: "search-item__body" },
                React.createElement("div", { className: "search-item__body-title" }, item.title))));
    };
    SearchResultSection.prototype.render = function () {
        var collapseClassNames = classNames({
            fa: true,
            'fa-plus': !this.props.section.expanded,
            'fa-minus': this.props.section.expanded,
            'search-section__header__toggle': true,
        });
        return (React.createElement("div", { className: "search-section", key: this.props.section.id },
            React.createElement("div", { className: "search-section__header" },
                React.createElement("i", { className: classNames('search-section__header__icon', this.props.section.icon) }),
                React.createElement("span", { className: "search-section__header__text" }, this.props.section.title),
                React.createElement("i", { className: collapseClassNames, onClick: this.toggleSection })),
            this.props.section.expanded && (React.createElement("div", { className: "search-section__items" }, this.props.section.items.map(this.renderItem)))));
    };
    return SearchResultSection;
}(React.Component));
export { SearchResultSection };
//# sourceMappingURL=SearchResult.js.map