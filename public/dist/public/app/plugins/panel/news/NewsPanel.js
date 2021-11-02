import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Utils & Services
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import config from 'app/core/config';
import { feedToDataFrame } from './utils';
import { loadRSSFeed } from './rss';
// Types
import { DataFrameView, dateTimeFormat, textUtil } from '@grafana/data';
import { DEFAULT_FEED_URL, PROXY_PREFIX } from './constants';
import { css, cx } from '@emotion/css';
var NewsPanel = /** @class */ (function (_super) {
    __extends(NewsPanel, _super);
    function NewsPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {};
        return _this;
    }
    NewsPanel.prototype.componentDidMount = function () {
        this.loadChannel();
    };
    NewsPanel.prototype.componentDidUpdate = function (prevProps) {
        if (this.props.options.feedUrl !== prevProps.options.feedUrl) {
            this.loadChannel();
        }
    };
    NewsPanel.prototype.loadChannel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options, url, res, frame, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = this.props.options;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        url = options.feedUrl
                            ? options.useProxy
                                ? "" + PROXY_PREFIX + options.feedUrl
                                : options.feedUrl
                            : DEFAULT_FEED_URL;
                        return [4 /*yield*/, loadRSSFeed(url)];
                    case 2:
                        res = _a.sent();
                        frame = feedToDataFrame(res);
                        this.setState({
                            news: new DataFrameView(frame),
                            isError: false,
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        console.error('Error Loading News', err_1);
                        this.setState({
                            news: undefined,
                            isError: true,
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NewsPanel.prototype.render = function () {
        var width = this.props.width;
        var showImage = this.props.options.showImage;
        var _a = this.state, isError = _a.isError, news = _a.news;
        var styles = getStyles(config.theme2);
        var useWideLayout = width > 600;
        if (isError) {
            return React.createElement("div", null, "Error Loading News");
        }
        if (!news) {
            return React.createElement("div", null, "loading...");
        }
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, news.map(function (item, index) {
            return (React.createElement("article", { key: index, className: cx(styles.item, useWideLayout && styles.itemWide) },
                showImage && item.ogImage && (React.createElement("a", { tabIndex: -1, href: textUtil.sanitizeUrl(item.link), target: "_blank", rel: "noopener noreferrer", className: cx(styles.socialImage, useWideLayout && styles.socialImageWide), "aria-hidden": true },
                    React.createElement("img", { src: item.ogImage, alt: item.title }))),
                React.createElement("div", { className: styles.body },
                    React.createElement("time", { className: styles.date, dateTime: dateTimeFormat(item.date, { format: 'MMM DD' }) },
                        dateTimeFormat(item.date, { format: 'MMM DD' }),
                        ' '),
                    React.createElement("a", { className: styles.link, href: textUtil.sanitizeUrl(item.link), target: "_blank", rel: "noopener noreferrer" },
                        React.createElement("h3", { className: styles.title }, item.title)),
                    React.createElement("div", { className: styles.content, dangerouslySetInnerHTML: { __html: textUtil.sanitize(item.content) } }))));
        })));
    };
    return NewsPanel;
}(PureComponent));
export { NewsPanel };
var getStyles = stylesFactory(function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    height: 100%;\n  "], ["\n    height: 100%;\n  "]))),
    item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    padding: ", ";\n    position: relative;\n    margin-bottom: 4px;\n    margin-right: ", ";\n    border-bottom: 2px solid ", ";\n    background: ", ";\n    flex-direction: column;\n    flex-shrink: 0;\n  "], ["\n    display: flex;\n    padding: ", ";\n    position: relative;\n    margin-bottom: 4px;\n    margin-right: ", ";\n    border-bottom: 2px solid ", ";\n    background: ", ";\n    flex-direction: column;\n    flex-shrink: 0;\n  "])), theme.spacing(1), theme.spacing(1), theme.colors.border.weak, theme.colors.background.primary),
    itemWide: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex-direction: row;\n  "], ["\n    flex-direction: row;\n  "]))),
    body: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n  "], ["\n    display: flex;\n    flex-direction: column;\n  "]))),
    socialImage: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    margin-bottom: ", ";\n    > img {\n      width: 100%;\n      border-radius: ", " ", " 0 0;\n    }\n  "], ["\n    display: flex;\n    align-items: center;\n    margin-bottom: ", ";\n    > img {\n      width: 100%;\n      border-radius: ", " ", " 0 0;\n    }\n  "])), theme.spacing(1), theme.shape.borderRadius(2), theme.shape.borderRadius(2)),
    socialImageWide: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    margin-right: ", ";\n    margin-bottom: 0;\n    > img {\n      width: 250px;\n      border-radius: ", ";\n    }\n  "], ["\n    margin-right: ", ";\n    margin-bottom: 0;\n    > img {\n      width: 250px;\n      border-radius: ", ";\n    }\n  "])), theme.spacing(2), theme.shape.borderRadius()),
    link: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n    display: inline-block;\n\n    &:hover {\n      color: ", ";\n      text-decoration: underline;\n    }\n  "], ["\n    color: ", ";\n    display: inline-block;\n\n    &:hover {\n      color: ", ";\n      text-decoration: underline;\n    }\n  "])), theme.colors.text.link, theme.colors.text.link),
    title: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    max-width: calc(100% - 70px);\n    font-size: 16px;\n    margin-bottom: ", ";\n  "], ["\n    max-width: calc(100% - 70px);\n    font-size: 16px;\n    margin-bottom: ", ";\n  "])), theme.spacing(0.5)),
    content: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    p {\n      margin-bottom: 4px;\n      color: ", ";\n    }\n  "], ["\n    p {\n      margin-bottom: 4px;\n      color: ", ";\n    }\n  "])), theme.colors.text),
    date: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    font-weight: 500;\n    border-radius: 0 0 0 3px;\n    color: ", ";\n  "], ["\n    margin-bottom: ", ";\n    font-weight: 500;\n    border-radius: 0 0 0 3px;\n    color: ", ";\n  "])), theme.spacing(0.5), theme.colors.text.secondary),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=NewsPanel.js.map