import angular from 'angular';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
var LinkSrv = /** @class */ (function () {
    /** @ngInject */
    function LinkSrv(templateSrv, timeSrv) {
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
    }
    LinkSrv.prototype.getLinkUrl = function (link) {
        var url = this.templateSrv.replace(link.url || '');
        var params = {};
        if (link.keepTime) {
            var range = this.timeSrv.timeRangeForUrl();
            params['from'] = range.from;
            params['to'] = range.to;
        }
        if (link.includeVars) {
            this.templateSrv.fillVariableValuesForUrl(params);
        }
        return this.addParamsToUrl(url, params);
    };
    LinkSrv.prototype.addParamsToUrl = function (url, params) {
        var paramsArray = [];
        _.each(params, function (value, key) {
            if (value === null) {
                return;
            }
            if (value === true) {
                paramsArray.push(key);
            }
            else if (_.isArray(value)) {
                _.each(value, function (instance) {
                    paramsArray.push(key + '=' + encodeURIComponent(instance));
                });
            }
            else {
                paramsArray.push(key + '=' + encodeURIComponent(value));
            }
        });
        if (paramsArray.length === 0) {
            return url;
        }
        return this.appendToQueryString(url, paramsArray.join('&'));
    };
    LinkSrv.prototype.appendToQueryString = function (url, stringToAppend) {
        if (!_.isUndefined(stringToAppend) && stringToAppend !== null && stringToAppend !== '') {
            var pos = url.indexOf('?');
            if (pos !== -1) {
                if (url.length - pos > 1) {
                    url += '&';
                }
            }
            else {
                url += '?';
            }
            url += stringToAppend;
        }
        return url;
    };
    LinkSrv.prototype.getAnchorInfo = function (link) {
        var info = {};
        info.href = this.getLinkUrl(link);
        info.title = this.templateSrv.replace(link.title || '');
        return info;
    };
    LinkSrv.prototype.getPanelLinkAnchorInfo = function (link, scopedVars) {
        var info = {};
        info.target = link.targetBlank ? '_blank' : '';
        if (link.type === 'absolute') {
            info.target = link.targetBlank ? '_blank' : '_self';
            info.href = this.templateSrv.replace(link.url || '', scopedVars);
            info.title = this.templateSrv.replace(link.title || '', scopedVars);
        }
        else if (link.url) {
            info.href = link.url;
            info.title = this.templateSrv.replace(link.title || '', scopedVars);
        }
        else if (link.dashUri) {
            info.href = 'dashboard/' + link.dashUri + '?';
            info.title = this.templateSrv.replace(link.title || '', scopedVars);
        }
        else {
            info.title = this.templateSrv.replace(link.title || '', scopedVars);
            var slug = kbn.slugifyForUrl(link.dashboard || '');
            info.href = 'dashboard/db/' + slug + '?';
        }
        var params = {};
        if (link.keepTime) {
            var range = this.timeSrv.timeRangeForUrl();
            params['from'] = range.from;
            params['to'] = range.to;
        }
        if (link.includeVars) {
            this.templateSrv.fillVariableValuesForUrl(params, scopedVars);
        }
        info.href = this.addParamsToUrl(info.href, params);
        if (link.params) {
            info.href = this.appendToQueryString(info.href, this.templateSrv.replace(link.params, scopedVars));
        }
        return info;
    };
    return LinkSrv;
}());
export { LinkSrv };
angular.module('grafana.services').service('linkSrv', LinkSrv);
//# sourceMappingURL=link_srv.js.map