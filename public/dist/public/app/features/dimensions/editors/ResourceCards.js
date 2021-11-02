import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useTheme2, stylesFactory } from '@grafana/ui';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
function Cell(props) {
    var columnIndex = props.columnIndex, rowIndex = props.rowIndex, style = props.style, data = props.data;
    var cards = data.cards, columnCount = data.columnCount, onChange = data.onChange, folder = data.folder;
    var singleColumnIndex = columnIndex + rowIndex * columnCount;
    var card = cards[singleColumnIndex];
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement("div", { style: style }, card && (React.createElement("div", { key: card.value, className: styles.card, onClick: function () { return onChange(folder.value + "/" + card.value); } },
        folder.value.includes('icons') ? (React.createElement(SVG, { src: card.imgUrl, className: styles.img })) : (React.createElement("img", { src: card.imgUrl, className: styles.img })),
        React.createElement("h6", { className: styles.text }, card.label.substr(0, card.label.length - 4))))));
}
var getStyles = stylesFactory(function (theme) {
    return {
        card: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: inline-block;\n      width: 80px;\n      height: 80px;\n      margin: 0.75rem;\n      text-align: center;\n      cursor: pointer;\n      position: relative;\n      background-color: transparent;\n      border: 1px solid transparent;\n      border-radius: 8px;\n      padding-top: 6px;\n\n      :hover {\n        border-color: ", ";\n        box-shadow: ", ";\n      }\n    "], ["\n      display: inline-block;\n      width: 80px;\n      height: 80px;\n      margin: 0.75rem;\n      text-align: center;\n      cursor: pointer;\n      position: relative;\n      background-color: transparent;\n      border: 1px solid transparent;\n      border-radius: 8px;\n      padding-top: 6px;\n\n      :hover {\n        border-color: ", ";\n        box-shadow: ", ";\n      }\n    "])), theme.colors.action.hover, theme.shadows.z2),
        img: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 50px;\n      height: 50px;\n      object-fit: cover;\n      vertical-align: middle;\n      fill: ", ";\n    "], ["\n      width: 50px;\n      height: 50px;\n      object-fit: cover;\n      vertical-align: middle;\n      fill: ", ";\n    "])), theme.colors.text.primary),
        text: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n      white-space: nowrap;\n      font-size: 12px;\n      text-overflow: ellipsis;\n      display: block;\n      overflow: hidden;\n    "], ["\n      color: ", ";\n      white-space: nowrap;\n      font-size: 12px;\n      text-overflow: ellipsis;\n      display: block;\n      overflow: hidden;\n    "])), theme.colors.text.primary),
    };
});
export var ResourceCards = function (props) {
    var onChange = props.onChange, cards = props.cards, folder = props.currentFolder;
    return (React.createElement(AutoSizer, { defaultWidth: 1920, defaultHeight: 1080 }, function (_a) {
        var width = _a.width, height = _a.height;
        var cardWidth = 80;
        var cardHeight = 80;
        var columnCount = Math.floor(width / cardWidth);
        var rowCount = Math.ceil(cards.length / columnCount);
        return (React.createElement(Grid, { width: width, height: height, columnCount: columnCount, columnWidth: cardWidth, rowCount: rowCount, rowHeight: cardHeight, itemData: { cards: cards, columnCount: columnCount, onChange: onChange, folder: folder } }, memo(Cell, areEqual)));
    }));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ResourceCards.js.map