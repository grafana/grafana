define([
  'angular',
  'kbn',
],
function (angular, kbn) {
  'use strict';

  angular
    .module('grafana.services')
    .service('linkSrv', function(templateSrv, timeSrv) {

      // parseUri 1.2.2
      // (c) Steven Levithan <stevenlevithan.com>
      // MIT License

      function parseUri (str) {
        var	o   = parseUri.options,
          m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
          uri = {},
          i   = 14;

        while (i--) {
          uri[o.key[i]] = m[i] || "";
        }

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
          if ($1) {
            uri[o.q.name][$1] = $2;
          }
        });

        return uri;
      }

      parseUri.options = {
        strictMode: false,
        key: ["source","protocol","authority","userInfo","user","password","host",
              "port","relative","path","directory","file","query","anchor"],
        q:   {
          name:   "queryKey",
          parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        /* jshint ignore:start */
        parser: {
          strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
          loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
        /* jshint ignore:end */
      };

      this.getLinkUrl = function(link) {
        var href = templateSrv.replace(link.url || '');
        if (link.addTime) {
          var range = timeSrv.timeRangeForUrl();
          href += (href.indexOf('?') !== -1 ? '&' : '?');
          href += 'from=' + range.from;
          href += '&to=' + range.to;
        }
        return href;
      };

      this.getAnchorInfo = function(link) {
        var info = {};
        info.href = this.getLinkUrl(link);
        info.title = templateSrv.replace(link.title || '');
        return info;
      };

      this.getPanelLinkAnchorInfo = function(link) {
        var info = {};
        if (link.type === 'absolute') {
          info.target = '_blank';
          info.href = templateSrv.replace(link.url || '');
          info.title = templateSrv.replace(link.title || '');
          info.href += '?';
        }
        else {
          info.title = templateSrv.replace(link.title || '');
          var slug = kbn.slugifyForUrl(link.dashboard || '');
          info.href = 'dashboard/db/' + slug + '?';
        }

        var range = timeSrv.timeRangeForUrl();
        info.href += 'from=' + range.from;
        info.href += '&to=' + range.to;

        if (link.params) {
          info.href += "&" + templateSrv.replace(link.params);
        }

        return info;
      };

    });
});
