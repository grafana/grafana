import { __awaiter, __extends, __generator } from "tslib";
import React, { Component } from 'react';
import { Icon } from '@grafana/ui';
import { encodeUrl } from '../aws_url';
var CloudWatchLink = /** @class */ (function (_super) {
    __extends(CloudWatchLink, _super);
    function CloudWatchLink() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { href: '' };
        return _this;
    }
    CloudWatchLink.prototype.componentDidUpdate = function (prevProps) {
        return __awaiter(this, void 0, void 0, function () {
            var panelDataNew, panelDataOld, href;
            return __generator(this, function (_a) {
                panelDataNew = this.props.panelData;
                panelDataOld = prevProps.panelData;
                if (panelDataOld !== panelDataNew && (panelDataNew === null || panelDataNew === void 0 ? void 0 : panelDataNew.request)) {
                    href = this.getExternalLink();
                    this.setState({ href: href });
                }
                return [2 /*return*/];
            });
        });
    };
    CloudWatchLink.prototype.getExternalLink = function () {
        var _a, _b, _c;
        var _d = this.props, query = _d.query, panelData = _d.panelData, datasource = _d.datasource;
        var range = (_a = panelData === null || panelData === void 0 ? void 0 : panelData.request) === null || _a === void 0 ? void 0 : _a.range;
        if (!range) {
            return '';
        }
        var start = range.from.toISOString();
        var end = range.to.toISOString();
        var urlProps = {
            end: end,
            start: start,
            timeType: 'ABSOLUTE',
            tz: 'UTC',
            editorString: (_b = query.expression) !== null && _b !== void 0 ? _b : '',
            isLiveTail: false,
            source: (_c = query.logGroupNames) !== null && _c !== void 0 ? _c : [],
        };
        return encodeUrl(urlProps, datasource.getActualRegion(query.region));
    };
    CloudWatchLink.prototype.render = function () {
        var href = this.state.href;
        return (React.createElement("a", { href: href, target: "_blank", rel: "noopener noreferrer" },
            React.createElement(Icon, { name: "share-alt" }),
            " CloudWatch Logs Insights"));
    };
    return CloudWatchLink;
}(Component));
export default CloudWatchLink;
//# sourceMappingURL=CloudWatchLink.js.map