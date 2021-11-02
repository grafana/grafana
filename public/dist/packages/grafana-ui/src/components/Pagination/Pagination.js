import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { Button } from '../Button';
import { Icon } from '../Icon/Icon';
var PAGE_LENGTH_TO_CONDENSE = 8;
export var Pagination = function (_a) {
    var currentPage = _a.currentPage, numberOfPages = _a.numberOfPages, onNavigate = _a.onNavigate, hideWhenSinglePage = _a.hideWhenSinglePage;
    var styles = getStyles();
    var pages = __spreadArray([], __read(new Array(numberOfPages).keys()), false);
    var condensePages = numberOfPages > PAGE_LENGTH_TO_CONDENSE;
    var getListItem = function (page, variant) { return (React.createElement("li", { key: page, className: styles.item },
        React.createElement(Button, { size: "sm", variant: variant, onClick: function () { return onNavigate(page); } }, page))); };
    var pageButtons = pages.reduce(function (pagesToRender, pageIndex) {
        var page = pageIndex + 1;
        var variant = page === currentPage ? 'primary' : 'secondary';
        // The indexes at which to start and stop condensing pages
        var lowerBoundIndex = PAGE_LENGTH_TO_CONDENSE;
        var upperBoundIndex = numberOfPages - PAGE_LENGTH_TO_CONDENSE + 1;
        // When the indexes overlap one another this number is negative
        var differenceOfBounds = upperBoundIndex - lowerBoundIndex;
        var isFirstOrLastPage = page === 1 || page === numberOfPages;
        // This handles when the lowerBoundIndex < currentPage < upperBoundIndex
        var currentPageIsBetweenBounds = differenceOfBounds > -1 && currentPage >= lowerBoundIndex && currentPage <= upperBoundIndex;
        if (condensePages) {
            if (isFirstOrLastPage ||
                (currentPage < lowerBoundIndex && page < lowerBoundIndex) ||
                (differenceOfBounds >= 0 && currentPage > upperBoundIndex && page > upperBoundIndex) ||
                (differenceOfBounds < 0 && currentPage >= lowerBoundIndex && page > upperBoundIndex) ||
                (currentPageIsBetweenBounds && page >= currentPage - 2 && page <= currentPage + 2)) {
                // Renders a button for the page
                pagesToRender.push(getListItem(page, variant));
            }
            else if ((page === lowerBoundIndex && currentPage < lowerBoundIndex) ||
                (page === upperBoundIndex && currentPage > upperBoundIndex) ||
                (currentPageIsBetweenBounds && (page === currentPage - 3 || page === currentPage + 3))) {
                // Renders and ellipsis to represent condensed pages
                pagesToRender.push(React.createElement("li", { key: page, className: styles.item },
                    React.createElement(Icon, { className: styles.ellipsis, name: "ellipsis-v" })));
            }
        }
        else {
            pagesToRender.push(getListItem(page, variant));
        }
        return pagesToRender;
    }, []);
    if (hideWhenSinglePage && numberOfPages <= 1) {
        return null;
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("ol", null,
            React.createElement("li", { className: styles.item },
                React.createElement(Button, { "aria-label": "previous", size: "sm", variant: "secondary", onClick: function () { return onNavigate(currentPage - 1); }, disabled: currentPage === 1 },
                    React.createElement(Icon, { name: "angle-left" }))),
            pageButtons,
            React.createElement("li", { className: styles.item },
                React.createElement(Button, { "aria-label": "next", size: "sm", variant: "secondary", onClick: function () { return onNavigate(currentPage + 1); }, disabled: currentPage === numberOfPages },
                    React.createElement(Icon, { name: "angle-right" }))))));
};
var getStyles = stylesFactory(function () {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      float: right;\n    "], ["\n      float: right;\n    "]))),
        item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: inline-block;\n      padding-left: 10px;\n      margin-bottom: 5px;\n    "], ["\n      display: inline-block;\n      padding-left: 10px;\n      margin-bottom: 5px;\n    "]))),
        ellipsis: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      transform: rotate(90deg);\n    "], ["\n      transform: rotate(90deg);\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=Pagination.js.map