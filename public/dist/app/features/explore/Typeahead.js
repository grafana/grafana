import * as tslib_1 from "tslib";
import React from 'react';
import Highlighter from 'react-highlight-words';
function scrollIntoView(el) {
    if (!el || !el.offsetParent) {
        return;
    }
    var container = el.offsetParent;
    if (el.offsetTop > container.scrollTop + container.offsetHeight || el.offsetTop < container.scrollTop) {
        container.scrollTop = el.offsetTop - container.offsetTop;
    }
}
var TypeaheadItem = /** @class */ (function (_super) {
    tslib_1.__extends(TypeaheadItem, _super);
    function TypeaheadItem() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.getRef = function (el) {
            _this.el = el;
        };
        _this.onClick = function () {
            _this.props.onClickItem(_this.props.item);
        };
        return _this;
    }
    TypeaheadItem.prototype.componentDidUpdate = function (prevProps) {
        var _this = this;
        if (this.props.isSelected && !prevProps.isSelected) {
            requestAnimationFrame(function () {
                scrollIntoView(_this.el);
            });
        }
    };
    TypeaheadItem.prototype.render = function () {
        var _a = this.props, isSelected = _a.isSelected, item = _a.item, prefix = _a.prefix;
        var className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
        var label = item.label || '';
        return (React.createElement("li", { ref: this.getRef, className: className, onClick: this.onClick },
            React.createElement(Highlighter, { textToHighlight: label, searchWords: [prefix], highlightClassName: "typeahead-match" }),
            item.documentation && isSelected ? React.createElement("div", { className: "typeahead-item-hint" }, item.documentation) : null));
    };
    return TypeaheadItem;
}(React.PureComponent));
var TypeaheadGroup = /** @class */ (function (_super) {
    tslib_1.__extends(TypeaheadGroup, _super);
    function TypeaheadGroup() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TypeaheadGroup.prototype.render = function () {
        var _a = this.props, items = _a.items, label = _a.label, selected = _a.selected, onClickItem = _a.onClickItem, prefix = _a.prefix;
        return (React.createElement("li", { className: "typeahead-group" },
            React.createElement("div", { className: "typeahead-group__title" }, label),
            React.createElement("ul", { className: "typeahead-group__list" }, items.map(function (item) {
                return (React.createElement(TypeaheadItem, { key: item.label, onClickItem: onClickItem, isSelected: selected === item, item: item, prefix: prefix }));
            }))));
    };
    return TypeaheadGroup;
}(React.PureComponent));
var Typeahead = /** @class */ (function (_super) {
    tslib_1.__extends(Typeahead, _super);
    function Typeahead() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Typeahead.prototype.render = function () {
        var _a = this.props, groupedItems = _a.groupedItems, menuRef = _a.menuRef, selectedItem = _a.selectedItem, onClickItem = _a.onClickItem, prefix = _a.prefix;
        return (React.createElement("ul", { className: "typeahead", ref: menuRef }, groupedItems.map(function (g) { return (React.createElement(TypeaheadGroup, tslib_1.__assign({ key: g.label, onClickItem: onClickItem, prefix: prefix, selected: selectedItem }, g))); })));
    };
    return Typeahead;
}(React.PureComponent));
export default Typeahead;
//# sourceMappingURL=Typeahead.js.map