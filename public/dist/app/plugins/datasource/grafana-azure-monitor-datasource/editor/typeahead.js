import * as tslib_1 from "tslib";
import React from 'react';
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
        return _this;
    }
    TypeaheadItem.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.isSelected && !prevProps.isSelected) {
            scrollIntoView(this.el);
        }
    };
    TypeaheadItem.prototype.render = function () {
        var _a = this.props, hint = _a.hint, isSelected = _a.isSelected, label = _a.label, onClickItem = _a.onClickItem;
        var className = isSelected ? 'typeahead-item typeahead-item__selected' : 'typeahead-item';
        var onClick = function () { return onClickItem(label); };
        return (React.createElement("li", { ref: this.getRef, className: className, onClick: onClick },
            label,
            hint && isSelected ? React.createElement("div", { className: "typeahead-item-hint" }, hint) : null));
    };
    return TypeaheadItem;
}(React.PureComponent));
var TypeaheadGroup = /** @class */ (function (_super) {
    tslib_1.__extends(TypeaheadGroup, _super);
    function TypeaheadGroup() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TypeaheadGroup.prototype.render = function () {
        var _a = this.props, items = _a.items, label = _a.label, selected = _a.selected, onClickItem = _a.onClickItem;
        return (React.createElement("li", { className: "typeahead-group" },
            React.createElement("div", { className: "typeahead-group__title" }, label),
            React.createElement("ul", { className: "typeahead-group__list" }, items.map(function (item) {
                var text = typeof item === 'object' ? item.text : item;
                var label = typeof item === 'object' ? item.display || item.text : item;
                return (React.createElement(TypeaheadItem, { key: text, onClickItem: onClickItem, isSelected: selected.indexOf(text) > -1, hint: item.hint, label: label }));
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
        var _a = this.props, groupedItems = _a.groupedItems, menuRef = _a.menuRef, selectedItems = _a.selectedItems, onClickItem = _a.onClickItem;
        return (React.createElement("ul", { className: "typeahead", ref: menuRef }, groupedItems.map(function (g) { return (React.createElement(TypeaheadGroup, tslib_1.__assign({ key: g.label, onClickItem: onClickItem, selected: selectedItems }, g))); })));
    };
    return Typeahead;
}(React.PureComponent));
export default Typeahead;
//# sourceMappingURL=typeahead.js.map