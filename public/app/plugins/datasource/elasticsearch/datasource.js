define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/kbn',
  'app/core/utils/datemath',
  './query_builder',
  './index_pattern',
  './elastic_response',
  './query_ctrl',
],
function (angular, _, moment, kbn, dateMath, ElasticQueryBuilder, IndexPattern, ElasticResponse) {
  'use strict';

  /** @ngInject */
  function ElasticDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv, contextSrv) {
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url;
    this.index = instanceSettings.index;
    this.name = instanceSettings.name;
    var tokenTemplate ={};
    tokenTemplate['_token'] = {value: MD5(backendSrv.getToken())};
    this.index = templateSrv.replace(this.index, tokenTemplate);
    instanceSettings.index = this.index;
    this.timeField = instanceSettings.jsonData.timeField;
    this.esVersion = instanceSettings.jsonData.esVersion;
    this.indexPattern = new IndexPattern(instanceSettings.index, instanceSettings.jsonData.interval);
    this.interval = instanceSettings.jsonData.timeInterval;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
      esVersion: this.esVersion,
    });

    this._request = function(method, url, data) {
      var options = {
        url: contextSrv.elkUrl + "/" + url,
        method: method,
        data: data
      };
      options.withCredentials = true;
      if (this.basicAuth) {
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    this._get = function(url) {
      return this._request('GET', this.indexPattern.getIndexForToday() + url).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    };

    this._post = function(url, data) {
      return this._request('POST', url, data).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    };

    this.annotationQuery = function(options) {
      var annotation = options.annotation;
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      var range = {};
      range[timeField]= {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
      };

      if (this.esVersion >= 2) {
        range[timeField]["format"] = "epoch_millis";
      }

      var queryInterpolated = templateSrv.replace(queryString);
      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
      var data = {
        "fields": [timeField, "_source"],
        "query" : { "filtered": { "query" : query, "filter": filter } },
        "size": 10000
      };

      var header = {search_type: "query_then_fetch", "ignore_unavailable": true};

      // old elastic annotations had index specified on them
      if (annotation.index) {
        header.index = annotation.index;
      } else {
        header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
      }

      var payload = angular.toJson(header) + '\n' + angular.toJson(data) + '\n';

      return this._post('log/search', payload).then(function(res) {
        var list = [];
        var hits = res.responses[0].hits.hits;

        var getFieldFromSource = function(source, fieldName) {
          if (!fieldName) { return; }

          var fieldNames = fieldName.split('.');
          var fieldValue = source;

          for (var i = 0; i < fieldNames.length; i++) {
            fieldValue = fieldValue[fieldNames[i]];
            if (!fieldValue) {
              console.log('could not find field in annotation: ', fieldName);
              return '';
            }
          }

          if (_.isArray(fieldValue)) {
            fieldValue = fieldValue.join(', ');
          }
          return fieldValue;
        };

        for (var i = 0; i < hits.length; i++) {
          var source = hits[i]._source;
          var fields = hits[i].fields;
          var time = source[timeField];

          if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
            time = fields[timeField];
          }

          var event = {
            annotation: annotation,
            time: moment.utc(time).valueOf(),
            title: getFieldFromSource(source, titleField),
            tags: getFieldFromSource(source, tagsField),
            text: getFieldFromSource(source, textField)
          };

          list.push(event);
        }
        return list;
      });
    };

    this.testDatasource = function() {
      return this._get('/_stats').then(function() {
        return { status: "success", message: "Data source is working", title: "Success" };
      }, function(err) {
        if (err.data && err.data.error) {
          return { status: "error", message: angular.toJson(err.data.error), title: "Error" };
        } else {
          return { status: "error", message: err.status, title: "Error" };
        }
      });
    };

    this.getQueryHeader = function(searchType, timeFrom, timeTo) {
      var header = {search_type: searchType, "ignore_unavailable": true};
      header.index = this.indexPattern.getIndexList(timeFrom, timeTo);
      return angular.toJson(header);
    };

    this.query = function(options) {
      var payload = "";
      var target;
      var sentTargets = [];

      for (var i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (target.hide) {continue;}

        var timeFrom = options.range.from;
        var timeTo = options.range.to;

        if(target.timeShift) {
          timeFrom = timeFrom.clone();
          timeFrom = dateMath.parseDateMath(target.timeShift, timeFrom);
          timeTo = timeTo.clone();
          timeTo = dateMath.parseDateMath(target.timeShift, timeTo);
        }

        var queryObj = this.queryBuilder.build(target);
        var esQuery = angular.toJson(queryObj);
        var luceneQuery = target.query || '*';
        luceneQuery = templateSrv.replace(luceneQuery, options.scopedVars, 'lucene');
        luceneQuery = angular.toJson(luceneQuery);

        // remove inner quotes
        luceneQuery = luceneQuery.substr(1, luceneQuery.length - 2);
        esQuery = esQuery.replace("$lucene_query", luceneQuery);
        esQuery = esQuery.replace(/\$timeFrom/g, timeFrom.valueOf());
        esQuery = esQuery.replace(/\$timeTo/g, timeTo.valueOf());

        var searchType = queryObj.size === 0 ? 'count' : 'query_then_fetch';
        var header = this.getQueryHeader(searchType, timeFrom, timeTo);
        payload +=  header + '\n';
        payload += esQuery + '\n';
        sentTargets.push(target);
      }

      if (sentTargets.length === 0) {
        return $q.when([]);
      }

      payload = payload.replace(/\$interval/g, options.interval);
      payload = templateSrv.replace(payload, options.scopedVars);

      if (options.scopedVars && options.scopedVars.logCluster) {
        return backendSrv.logCluster({
          method: "POST",
          url: "/log/clustering",
          data: payload
        }).then(function (res) {
          res.data = [
            {target: 'docs', type: 'docs', datapoints: res.data}
          ];
          return res;
        });
      } else if (options.scopedVars && options.scopedVars.logCompare) {
        return backendSrv.logCluster({
          method: "POST",
          url: "/log/compare",
          data: payload
        }).then(function (res) {
          _.each(res.data, function (target) {
            compare(target);
          });
          res.data = [
            {target: 'docs', type: 'docs', datapoints: res.data}
          ];
          return res;
        });
      } else {
        return this._post("log/search", payload).then(function (res) {
          return new ElasticResponse(sentTargets, res).getTimeSeries();
        });
      }
    };

    this.getFields = function(query) {
      return this._get('/_mapping').then(function(res) {
        var fields = {};
        var typeMap = {
          'float': 'number',
          'double': 'number',
          'integer': 'number',
          'long': 'number',
          'date': 'date',
          'string': 'string',
        };

        for (var indexName in res) {
          var index = res[indexName];
          var mappings = index.mappings;
          if (!mappings) { continue; }
          for (var typeName in mappings) {
            var properties = mappings[typeName].properties;
            for (var field in properties) {
              var prop = properties[field];
              if (query.type && typeMap[prop.type] !== query.type) {
                continue;
              }
              if (prop.type && field[0] !== '_') {
                fields[field] = {text: field, type: prop.type};
              }
            }
          }
        }

        // transform to array
        return _.map(fields, function(value) {
          return value;
        });
      });
    };

    this.getTerms = function(queryDef) {
      var range = timeSrv.timeRange();
      var header = this.getQueryHeader('count', range.from, range.to);
      var esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

      esQuery = esQuery.replace("$lucene_query", queryDef.query || '*');
      esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf());
      esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf());
      esQuery = header + '\n' + esQuery + '\n';

      return this._post('log/search?search_type=count', esQuery).then(function(res) {
        var buckets = res.responses[0].aggregations["1"].buckets;
        return _.map(buckets, function(bucket) {
          return {text: bucket.key, value: bucket.key};
        });
      });
    };

    this.metricFindQuery = function(query) {
      query = templateSrv.replace(query);
      query = angular.fromJson(query);
      if (!query) {
        return $q.when([]);
      }

      if (query.find === 'fields') {
        return this.getFields(query);
      }
      if (query.find === 'terms') {
        return this.getTerms(query);
      }
    };

    this.getDashboard = function(id) {
      return this._get('/dashboard/' + id)
      .then(function(result) {
        return angular.fromJson(result._source.dashboard);
      });
    };

    this.searchDashboards = function() {
      var query = {
        query: { query_string: { query: '*' } },
        size: 10000,
        sort: ["_uid"],
      };

      return this._post(this.index + '/dashboard/_search', query)
      .then(function(results) {
        if(_.isUndefined(results.hits)) {
          return { dashboards: [], tags: [] };
        }

        var resultsHits = results.hits.hits;
        var displayHits = { dashboards: [] };

        for (var i = 0, len = resultsHits.length; i < len; i++) {
          var hit = resultsHits[i];
          displayHits.dashboards.push({
            id: hit._id,
            title: hit._source.title,
            tags: hit._source.tags
          });
        }

        return displayHits;
      });
    };
  }

  function compare(target) {
    if (target.count0 == 0 && target.count1 > 0) {
      target.count = "消失日志:" + target.count1;
    } else if (target.count0 > 0 && target.count1 == 0) {
      target.count = "新增日志:" + target.count0;
    } else if (target.count0 > 0 && target.count1 > 0 && target.count0 >= target.count1) {
      var num = ((Math.abs(target.count0 - target.count1) / target.count1)*100).toFixed();
      target.count = "出现次数:" + target.count0 + "<br>同比增长" + num + "%";
    } else if (target.count0 > 0 && target.count1 > 0 && target.count0 < target.count1) {
      var num = ((Math.abs(target.count0 - target.count1) / target.count0)*100).toFixed();
      target.count = "出现次数:" + target.count0 + "<br>同比减少" + num + "%";
    } else {
      target.count = "0";
    }
  };

  function MD5(e) {
    function h(a, b) {
      var c, d, e, f, g;
      e = a & 2147483648;
      f = b & 2147483648;
      c = a & 1073741824;
      d = b & 1073741824;
      g = (a & 1073741823) + (b & 1073741823);
      return c & d ? g ^ 2147483648 ^ e ^ f : c | d ? g & 1073741824 ? g ^ 3221225472 ^ e ^ f : g ^ 1073741824 ^ e ^ f : g ^ e ^ f
    }

    function k(a, b, c, d, e, f, g) {
      a = h(a, h(h(b & c | ~b & d, e), g));
      return h(a << f | a >>> 32 - f, b)
    }

    function l(a, b, c, d, e, f, g) {
      a = h(a, h(h(b & d | c & ~d, e), g));
      return h(a << f | a >>> 32 - f, b)
    }

    function m(a, b, d, c, e, f, g) {
      a = h(a, h(h(b ^ d ^ c, e), g));
      return h(a << f | a >>> 32 - f, b)
    }

    function n(a, b, d, c, e, f, g) {
      a = h(a, h(h(d ^ (b | ~c), e), g));
      return h(a << f | a >>> 32 - f, b)
    }

    function p(a) {
      var b = "",
        d = "",
        c;
      for (c = 0; 3 >= c; c++) d = a >>> 8 * c & 255, d = "0" + d.toString(16), b += d.substr(d.length - 2, 2);
      return b
    }

    var f = [],
      q, r, s, t, a, b, c, d;
    e = function (a) {
      a = a.replace(/\r\n/g, "\n");
      for (var b = "", d = 0; d < a.length; d++) {
        var c = a.charCodeAt(d);
        128 > c ? b += String.fromCharCode(c) : (127 < c && 2048 > c ? b += String.fromCharCode(c >> 6 | 192) : (b += String.fromCharCode(c >> 12 | 224), b += String.fromCharCode(c >> 6 & 63 | 128)), b += String.fromCharCode(c & 63 | 128))
      }
      return b
    }(e);
    f = function (b) {
      var a, c = b.length;
      a = c + 8;
      for (var d = 16 * ((a - a % 64) / 64 + 1), e = Array(d - 1), f = 0, g = 0; g < c;) a = (g - g % 4) / 4, f = g % 4 * 8, e[a] |= b.charCodeAt(g) << f, g++;
      a = (g - g % 4) / 4;
      e[a] |= 128 << g % 4 * 8;
      e[d - 2] = c << 3;
      e[d - 1] = c >>> 29;
      return e
    }(e);
    a = 1732584193;
    b = 4023233417;
    c = 2562383102;
    d = 271733878;
    for (e = 0; e < f.length; e += 16) q = a, r = b, s = c, t = d, a = k(a, b, c, d, f[e + 0], 7, 3614090360), d = k(d, a, b, c, f[e + 1], 12, 3905402710), c = k(c, d, a, b, f[e + 2], 17, 606105819), b = k(b, c, d, a, f[e + 3], 22, 3250441966), a = k(a, b, c, d, f[e + 4], 7, 4118548399), d = k(d, a, b, c, f[e + 5], 12, 1200080426), c = k(c, d, a, b, f[e + 6], 17, 2821735955), b = k(b, c, d, a, f[e + 7], 22, 4249261313), a = k(a, b, c, d, f[e + 8], 7, 1770035416), d = k(d, a, b, c, f[e + 9], 12, 2336552879), c = k(c, d, a, b, f[e + 10], 17, 4294925233), b = k(b, c, d, a, f[e + 11], 22, 2304563134), a = k(a, b, c, d, f[e + 12], 7, 1804603682), d = k(d, a, b, c, f[e + 13], 12, 4254626195), c = k(c, d, a, b, f[e + 14], 17, 2792965006), b = k(b, c, d, a, f[e + 15], 22, 1236535329), a = l(a, b, c, d, f[e + 1], 5, 4129170786), d = l(d, a, b, c, f[e + 6], 9, 3225465664), c = l(c, d, a, b, f[e + 11], 14, 643717713), b = l(b, c, d, a, f[e + 0], 20, 3921069994), a = l(a, b, c, d, f[e + 5], 5, 3593408605), d = l(d, a, b, c, f[e + 10], 9, 38016083), c = l(c, d, a, b, f[e + 15], 14, 3634488961), b = l(b, c, d, a, f[e + 4], 20, 3889429448), a = l(a, b, c, d, f[e + 9], 5, 568446438), d = l(d, a, b, c, f[e + 14], 9, 3275163606), c = l(c, d, a, b, f[e + 3], 14, 4107603335), b = l(b, c, d, a, f[e + 8], 20, 1163531501), a = l(a, b, c, d, f[e + 13], 5, 2850285829), d = l(d, a, b, c, f[e + 2], 9, 4243563512), c = l(c, d, a, b, f[e + 7], 14, 1735328473), b = l(b, c, d, a, f[e + 12], 20, 2368359562), a = m(a, b, c, d, f[e + 5], 4, 4294588738), d = m(d, a, b, c, f[e + 8], 11, 2272392833), c = m(c, d, a, b, f[e + 11], 16, 1839030562), b = m(b, c, d, a, f[e + 14], 23, 4259657740), a = m(a, b, c, d, f[e + 1], 4, 2763975236), d = m(d, a, b, c, f[e + 4], 11, 1272893353), c = m(c, d, a, b, f[e + 7], 16, 4139469664), b = m(b, c, d, a, f[e + 10], 23, 3200236656), a = m(a, b, c, d, f[e + 13], 4, 681279174), d = m(d, a, b, c, f[e + 0], 11, 3936430074), c = m(c, d, a, b, f[e + 3], 16, 3572445317), b = m(b, c, d, a, f[e + 6], 23, 76029189), a = m(a, b, c, d, f[e + 9], 4, 3654602809), d = m(d, a, b, c, f[e + 12], 11, 3873151461), c = m(c, d, a, b, f[e + 15], 16, 530742520), b = m(b, c, d, a, f[e + 2], 23, 3299628645), a = n(a, b, c, d, f[e + 0], 6, 4096336452), d = n(d, a, b, c, f[e + 7], 10, 1126891415), c = n(c, d, a, b, f[e + 14], 15, 2878612391), b = n(b, c, d, a, f[e + 5], 21, 4237533241), a = n(a, b, c, d, f[e + 12], 6, 1700485571), d = n(d, a, b, c, f[e + 3], 10, 2399980690), c = n(c, d, a, b, f[e + 10], 15, 4293915773), b = n(b, c, d, a, f[e + 1], 21, 2240044497), a = n(a, b, c, d, f[e + 8], 6, 1873313359), d = n(d, a, b, c, f[e + 15], 10, 4264355552), c = n(c, d, a, b, f[e + 6], 15, 2734768916), b = n(b, c, d, a, f[e + 13], 21, 1309151649), a = n(a, b, c, d, f[e + 4], 6, 4149444226), d = n(d, a, b, c, f[e + 11], 10, 3174756917), c = n(c, d, a, b, f[e + 2], 15, 718787259), b = n(b, c, d, a, f[e + 9], 21, 3951481745), a = h(a, q), b = h(b, r), c = h(c, s), d = h(d, t);
    return (p(a) + p(b) + p(c) + p(d)).toLowerCase()
  };

  return {
    ElasticDatasource: ElasticDatasource
  };
});
