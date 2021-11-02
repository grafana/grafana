import { default as calculateSize } from 'calculate-size';
import { CompletionItemKind } from '../types/completion';
export var flattenGroupItems = function (groupedItems) {
    return groupedItems.reduce(function (all, _a) {
        var items = _a.items, label = _a.label;
        all.push({
            label: label,
            kind: CompletionItemKind.GroupTitle,
        });
        return items.reduce(function (all, item) {
            all.push(item);
            return all;
        }, all);
    }, []);
};
export var calculateLongestLabel = function (allItems) {
    return allItems.reduce(function (longest, current) {
        return longest.length < current.label.length ? current.label : longest;
    }, '');
};
export var calculateListSizes = function (theme, allItems, longestLabel) {
    var size = calculateSize(longestLabel, {
        font: theme.typography.fontFamily.monospace,
        fontSize: theme.typography.size.sm,
        fontWeight: 'normal',
    });
    var listWidth = calculateListWidth(size.width, theme);
    var itemHeight = calculateItemHeight(size.height, theme);
    var listHeight = calculateListHeight(itemHeight, allItems);
    return {
        listWidth: listWidth,
        listHeight: listHeight,
        itemHeight: itemHeight,
    };
};
export var calculateItemHeight = function (longestLabelHeight, theme) {
    var horizontalPadding = parseInt(theme.spacing.sm, 10) * 2;
    var itemHeight = longestLabelHeight + horizontalPadding;
    return itemHeight;
};
export var calculateListWidth = function (longestLabelWidth, theme) {
    var verticalPadding = parseInt(theme.spacing.sm, 10) + parseInt(theme.spacing.md, 10);
    var maxWidth = 800;
    var listWidth = Math.min(Math.max(longestLabelWidth + verticalPadding, 200), maxWidth);
    return listWidth;
};
export var calculateListHeight = function (itemHeight, allItems) {
    var numberOfItemsToShow = Math.min(allItems.length, 10);
    var minHeight = 100;
    var totalHeight = numberOfItemsToShow * itemHeight;
    var listHeight = Math.max(totalHeight, minHeight);
    return listHeight;
};
//# sourceMappingURL=typeahead.js.map