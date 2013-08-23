/*jshint globalstrict:true */
/*global angular:true */
/*global Blob:false*/
'use strict';

angular.module('kibana.services', [])
.service('alertSrv', function($timeout) {
  var self = this;

  // List of all alert objects
  this.list = [];

  this.set = function(title,text,severity,timeout) {
    var _a = {
      title: title || '',
      text: text || '',
      severity: severity || 'info',
    };
    self.list.push(_a);
    if (timeout > 0) {
      $timeout(function() {
        self.list = _.without(self.list,_a);
      }, timeout);
    }
  };

  this.clear = function(alert) {
    self.list = _.without(self.list,alert);
  };

  this.clearAll = function() {
    self.list = [];
  };

})
.service('fields', function(dashboard, $rootScope, $http, alertSrv) {
  // Save a reference to this
  var self = this;

  this.list = ['_type'];
  this.mapping = {};

  this.add_fields = function(f) {
    //self.list = _.union(f,self.list);
  };

  $rootScope.$watch(function(){return dashboard.indices;},function(n) {
    if(!_.isUndefined(n) && n.length) {
      // Only get the mapping for indices we don't know it for
      var indices = _.difference(n,_.keys(self.mapping));
      // Only get the mapping if there are indices
      if(indices.length > 0) {
        self.map(indices).then(function(result) {
          self.mapping = _.extend(self.mapping,result);
          self.list = mapFields(self.mapping);
        });
      // Otherwise just use the cached mapping
      } else {
        self.list = mapFields(_.pick(self.mapping,n));
      }
    }
  });

  var mapFields = function (m) {
    var fields = [];
    _.each(m, function(types,index) {
      _.each(types, function(v,k) {
        fields = _.union(fields,_.keys(v));
      });
    });
    return fields;
  };

  this.map = function(indices) {
    var request = $http({
      url: config.elasticsearch + "/" + indices.join(',') + "/_mapping",
      method: "GET"
    }).error(function(data, status, headers, conf) {
      if(status === 0) {
        alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
          ". Please ensure that Elasticsearch is reachable from your system." ,'error');
      } else {
        alertSrv.set('Error',"Could not find "+config.elasticsearch+"/"+indices.join(',')+"/_mapping. If you"+
          " are using a proxy, ensure it is configured correctly",'error');
      }
    });

    return request.then(function(p) {
      var mapping = {};
      _.each(p.data, function(v,k) {
        mapping[k] = {};
        _.each(v, function (v,f) {
          mapping[k][f] = flatten(v);
        });
      });
      return mapping;
    });
  };

  var flatten = function(obj,prefix) {
    var propName = (prefix) ? prefix :  '',
      dot = (prefix) ? '.':'',
      ret = {};
    for(var attr in obj){
      // For now only support multi field on the top level
      // and if if there is a default field set.
      if(obj[attr]['type'] === 'multi_field') {
        ret[attr] = obj[attr]['fields'][attr] || obj[attr];
        continue;
      }
      if (attr === 'properties') {
        _.extend(ret,flatten(obj[attr], propName));
      } else if(typeof obj[attr] === 'object'){
        _.extend(ret,flatten(obj[attr], propName + dot + attr));
      } else {
        ret[propName] = obj;
      }
    }
    return ret;
  };

})
.service('kbnIndex',function($http,alertSrv) {

  // returns a promise containing an array of all indices matching the index
  // pattern that exist in a given range
  this.indices = function(from,to,pattern,interval) {
    var possible = [];
    _.each(expand_range(fake_utc(from),fake_utc(to),interval),function(d){
      possible.push(d.format(pattern));
    });

    return all_indices().then(function(p) {
      var indices = _.intersection(possible,p);
      indices.reverse();
      return indices;
    });
  };

  // returns a promise containing an array of all indices in an elasticsearch
  // cluster
  function all_indices() {
    var something = $http({
      url: config.elasticsearch + "/_aliases",
      method: "GET"
    }).error(function(data, status, headers, conf) {
      if(status === 0) {
        alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
          ". Please ensure that Elasticsearch is reachable from your system." ,'error');
      } else {
        alertSrv.set('Error',"Could not reach "+config.elasticsearch+"/_aliases. If you"+
          " are using a proxy, ensure it is configured correctly",'error');
      }
    });

    return something.then(function(p) {
      var indices = [];
      _.each(p.data, function(v,k) {
        indices.push(k);
        // Also add the aliases. Could be expensive on systems with a lot of them
        _.each(v.aliases, function(v, k) {
          indices.push(k);
        });
      });
      return indices;
    });
  }

  // this is stupid, but there is otherwise no good way to ensure that when
  // I extract the date from an object that I get the UTC date. Stupid js.
  // I die a little inside every time I call this function.
  // Update: I just read this again. I died a little more inside.
  // Update2: More death.
  function fake_utc(date) {
    date = moment(date).clone().toDate();
    return moment(new Date(date.getTime() + date.getTimezoneOffset() * 60000));
  }

  // Create an array of date objects by a given interval
  function expand_range(start, end, interval) {
    if(_.contains(['hour','day','week','month','year'],interval)) {
      var range;
      start = moment(start).clone();
      range = [];
      while (start.isBefore(end)) {
        range.push(start.clone());
        switch (interval) {
        case 'hour':
          start.add('hours',1);
          break;
        case 'day':
          start.add('days',1);
          break;
        case 'week':
          start.add('weeks',1);
          break;
        case 'month':
          start.add('months',1);
          break;
        case 'year':
          start.add('years',1);
          break;
        }
      }
      range.push(moment(end).clone());
      return range;
    } else {
      return false;
    }
  }
})
.service('timer', function($timeout) {
  // This service really just tracks a list of $timeout promises to give us a
  // method for cancelling them all when we need to

  var timers = [];

  this.register = function(promise) {
    timers.push(promise);
    return promise;
  };

  this.cancel = function(promise) {
    timers = _.without(timers,promise);
    $timeout.cancel(promise);
  };

  this.cancel_all = function() {
    _.each(timers, function(t){
      $timeout.cancel(t);
    });
    timers = [];
  };

})
.service('querySrv', function(dashboard, ejsResource) {
  // Create an object to hold our service state on the dashboard
  dashboard.current.services.query = dashboard.current.services.query || {};
  _.defaults(dashboard.current.services.query,{
    idQueue : [],
    list : {},
    ids : [],
  });

  // For convenience
  var ejs = ejsResource(config.elasticsearch);
  var _q = dashboard.current.services.query;

  this.colors = [
    "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
    "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
    "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
    "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
    "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
    "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
    "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
  ];


  // Save a reference to this
  var self = this;

  this.init = function() {
    _q = dashboard.current.services.query;
    self.list = dashboard.current.services.query.list;
    self.ids = dashboard.current.services.query.ids;

    if (self.ids.length === 0) {
      self.set({});
    }
  };

  // This is used both for adding queries and modifying them. If an id is passed, the query at that id is updated
  this.set = function(query,id) {
    if(!_.isUndefined(id)) {
      if(!_.isUndefined(self.list[id])) {
        _.extend(self.list[id],query);
        return id;
      } else {
        return false;
      }
    } else {
      var _id = nextId();
      var _query = {
        query: '*',
        alias: '',
        color: colorAt(_id),
        pin: false,
        id: _id,
        type: 'lucene'
      };
      _.defaults(query,_query);
      self.list[_id] = query;
      self.ids.push(_id);
      return _id;
    }
  };

  this.remove = function(id) {
    if(!_.isUndefined(self.list[id])) {
      delete self.list[id];
      // This must happen on the full path also since _.without returns a copy
      self.ids = dashboard.current.services.query.ids = _.without(self.ids,id);
      _q.idQueue.unshift(id);
      _q.idQueue.sort(function(v,k){
        return v-k;
      });
      return true;
    } else {
      return false;
    }
  };

  this.getEjsObj = function(id) {
    return self.toEjsObj(self.list[id]);
  };

  this.toEjsObj = function (q) {
    switch(q.type)
    {
    case 'lucene':
      return ejs.QueryStringQuery(q.query || '*');
    default:
      return _.isUndefined(q.query) ? false : ejs.QueryStringQuery(q.query || '*');
    }
  };

  this.findQuery = function(queryString) {
    return _.findWhere(self.list,{query:queryString});
  };

  this.idsByMode = function(config) {
    switch(config.mode)
    {
    case 'all':
      return self.ids;
    case 'pinned':
      return _.pluck(_.where(self.list,{pin:true}),'id');
    case 'unpinned':
      return _.difference(self.ids,_.pluck(_.where(self.list,{pin:true}),'id'));
    case 'selected':
      return _.intersection(self.ids,config.ids);
    default:
      return self.ids;
    }
  };

  var nextId = function() {
    if(_q.idQueue.length > 0) {
      return _q.idQueue.shift();
    } else {
      return self.ids.length;
    }
  };

  var colorAt = function(id) {
    return self.colors[id % self.colors.length];
  };

  self.init();

})
.service('filterSrv', function(dashboard, ejsResource) {
  // Create an object to hold our service state on the dashboard
  dashboard.current.services.filter = dashboard.current.services.filter || {};
  _.defaults(dashboard.current.services.filter,{
    idQueue : [],
    list : {},
    ids : []
  });

  // For convenience
  var ejs = ejsResource(config.elasticsearch);
  var _f = dashboard.current.services.filter;

  // Save a reference to this
  var self = this;

  // Call this whenever we need to reload the important stuff
  this.init = function() {
    // Accessors
    self.list = dashboard.current.services.filter.list;
    self.ids = dashboard.current.services.filter.ids;
    _f = dashboard.current.services.filter;

    _.each(self.getByType('time',true),function(time) {
      self.list[time.id].from = new Date(time.from);
      self.list[time.id].to = new Date(time.to);
    });

  };

  // This is used both for adding filters and modifying them.
  // If an id is passed, the filter at that id is updated
  this.set = function(filter,id) {
    _.defaults(filter,{mandate:'must'});
    filter.active = true;
    if(!_.isUndefined(id)) {
      if(!_.isUndefined(self.list[id])) {
        _.extend(self.list[id],filter);
        return id;
      } else {
        return false;
      }
    } else {
      if(_.isUndefined(filter.type)) {
        return false;
      } else {
        var _id = nextId();
        var _filter = {
          alias: '',
          id: _id
        };
        _.defaults(filter,_filter);
        self.list[_id] = filter;
        self.ids.push(_id);
        return _id;
      }
    }
  };

  this.getBoolFilter = function(ids) {
    // A default match all filter, just in case there are no other filters
    var bool = ejs.BoolFilter().must(ejs.MatchAllFilter());
    var either_bool = ejs.BoolFilter().must(ejs.MatchAllFilter());
    _.each(ids,function(id) {
      if(self.list[id].active) {
        switch(self.list[id].mandate)
        {
        case 'mustNot':
          bool = bool.mustNot(self.getEjsObj(id));
          break;
        case 'either':
          either_bool = either_bool.should(self.getEjsObj(id));
          break;
        default:
          bool = bool.must(self.getEjsObj(id));
        }
      }
    });
    return bool.must(either_bool);
  };

  this.getEjsObj = function(id) {
    return self.toEjsObj(self.list[id]);
  };

  this.toEjsObj = function (filter) {
    if(!filter.active) {
      return false;
    }
    switch(filter.type)
    {
    case 'time':
      return ejs.RangeFilter(filter.field)
        .from(filter.from.valueOf())
        .to(filter.to.valueOf());
    case 'range':
      return ejs.RangeFilter(filter.field)
        .from(filter.from)
        .to(filter.to);
    case 'querystring':
      return ejs.QueryFilter(ejs.QueryStringQuery(filter.query)).cache(true);
    case 'field':
      return ejs.QueryFilter(ejs.FieldQuery(filter.field,filter.query)).cache(true);
    case 'terms':
      return ejs.TermsFilter(filter.field,filter.value);
    case 'exists':
      return ejs.ExistsFilter(filter.field);
    case 'missing':
      return ejs.MissingFilter(filter.field);
    default:
      return false;
    }
  };

  this.getByType = function(type,inactive) {
    return _.pick(self.list,self.idsByType(type,inactive));
  };

  this.removeByType = function(type) {
    var ids = self.idsByType(type);
    _.each(ids,function(id) {
      self.remove(id);
    });
    return ids;
  };

  this.idsByType = function(type,inactive) {
    var _require = inactive ? {type:type} : {type:type,active:true};
    return _.pluck(_.where(self.list,_require),'id');
  };

  // TOFIX: Error handling when there is more than one field
  this.timeField = function() {
    return _.pluck(self.getByType('time'),'field');
  };

  // This special function looks for all time filters, and returns a time range according to the mode
  // No idea when max would actually be used
  this.timeRange = function(mode) {
    var _t = _.where(self.list,{type:'time',active:true});
    if(_t.length === 0) {
      return false;
    }
    switch(mode) {
    case "min":
      return {
        from: new Date(_.max(_.pluck(_t,'from'))),
        to: new Date(_.min(_.pluck(_t,'to')))
      };
    case "max":
      return {
        from: new Date(_.min(_.pluck(_t,'from'))),
        to: new Date(_.max(_.pluck(_t,'to')))
      };
    default:
      return false;
    }
  };

  this.remove = function(id) {
    if(!_.isUndefined(self.list[id])) {
      delete self.list[id];
      // This must happen on the full path also since _.without returns a copy
      self.ids = dashboard.current.services.filter.ids = _.without(self.ids,id);
      _f.idQueue.unshift(id);
      _f.idQueue.sort(function(v,k){return v-k;});
      return true;
    } else {
      return false;
    }
  };


  var nextId = function() {
    if(_f.idQueue.length > 0) {
      return _f.idQueue.shift();
    } else {
      return self.ids.length;
    }
  };

  // Now init
  self.init();

})
.service('dashboard', function($routeParams, $http, $rootScope, $injector, ejsResource, timer, kbnIndex, alertSrv) {
  // A hash of defaults to use when loading a dashboard

  var _dash = {
    title: "",
    style: "dark",
    editable: true,
    failover: false,
    rows: [],
    services: {},
    index: {
      interval: 'none',
      pattern: '_all',
      default: 'INDEX_MISSING'
    },
  };

  // An elasticJS client to use
  var ejs = ejsResource(config.elasticsearch);
  var gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;

  // Store a reference to this
  var self = this;
  var filterSrv,querySrv;

  this.current = _.clone(_dash);
  this.last = {};

  $rootScope.$on('$routeChangeSuccess',function(){
    // Clear the current dashboard to prevent reloading
    self.current = {};
    self.indices = [];
    route();
  });

  var route = function() {
    // Is there a dashboard type and id in the URL?
    if(!(_.isUndefined($routeParams.type)) && !(_.isUndefined($routeParams.id))) {
      var _type = $routeParams.type;
      var _id = $routeParams.id;

      switch(_type) {
      case ('elasticsearch'):
        self.elasticsearch_load('dashboard',_id);
        break;
      case ('temp'):
        self.elasticsearch_load('temp',_id);
        break;
      case ('file'):
        self.file_load(_id);
        break;
      default:
        self.file_load('default.json');
      }

    // No dashboard in the URL
    } else {
      // Check if browser supports localstorage, and if there's a dashboard
      if (window.Modernizr.localstorage &&
        !(_.isUndefined(window.localStorage['dashboard'])) &&
        window.localStorage['dashboard'] !== ''
      ) {
        var dashboard = JSON.parse(window.localStorage['dashboard']);
        self.dash_load(dashboard);
      // No? Ok, grab default.json, its all we have now
      } else {
        self.file_load('default.json');
      }
    }
  };

  // Since the dashboard is responsible for index computation, we can compute and assign the indices
  // here before telling the panels to refresh
  this.refresh = function() {
    if(self.current.index.interval !== 'none') {
      if(filterSrv.idsByType('time').length > 0) {
        var _range = filterSrv.timeRange('min');
        kbnIndex.indices(_range.from,_range.to,
          self.current.index.pattern,self.current.index.interval
        ).then(function (p) {
          if(p.length > 0) {
            self.indices = p;
          } else {
            //TODO: Option to not failover
            if(self.current.failover) {
              self.indices = [self.current.index.default];
            } else {
              alertSrv.set('No indices matched','The pattern <i>'+self.current.index.pattern+
                '</i> did not match any indices in your selected'+
                ' time range.','info',5000);
              // Do not issue refresh if no indices match. This should be removed when panels
              // properly understand when no indices are present
              return false;
            }
          }
          $rootScope.$broadcast('refresh');
        });
      } else {
        // This is not optimal, we should be getting the entire index list here, or at least every
        // index that possibly matches the pattern
        self.indices = [self.current.index.default];
        $rootScope.$broadcast('refresh');
      }
    } else {
      self.indices = [self.current.index.default];
      $rootScope.$broadcast('refresh');
    }
  };

  this.dash_load = function(dashboard) {
    // Cancel all timers
    timer.cancel_all();

    // Make sure the dashboard being loaded has everything required
    _.defaults(dashboard,_dash);

    // If not using time based indices, use the default index
    if(dashboard.index.interval === 'none') {
      self.indices = [dashboard.index.default];
    }

    self.current = _.clone(dashboard);

    // Ok, now that we've setup the current dashboard, we can inject our services
    querySrv = $injector.get('querySrv');
    filterSrv = $injector.get('filterSrv');

    // Make sure these re-init
    querySrv.init();
    filterSrv.init();

    // If there's an index interval set and no existing time filter, send a refresh to set one
    if(dashboard.index.interval !== 'none' && filterSrv.idsByType('time').length === 0) {
      self.refresh();
    }

    return true;
  };

  this.gist_id = function(string) {
    if(self.is_gist(string)) {
      return string.match(gist_pattern)[0].replace(/.*\//, '');
    }
  };

  this.is_gist = function(string) {
    if(!_.isUndefined(string) && string !== '' && !_.isNull(string.match(gist_pattern))) {
      return string.match(gist_pattern).length > 0 ? true : false;
    } else {
      return false;
    }
  };

  this.to_file = function() {
    var blob = new Blob([angular.toJson(self.current,true)], {type: "application/json;charset=utf-8"});
    // from filesaver.js
    window.saveAs(blob, self.current.title+"-"+new Date().getTime());
    return true;
  };

  this.set_default = function(dashboard) {
    if (window.Modernizr.localstorage) {
      window.localStorage['dashboard'] = angular.toJson(dashboard || self.current);
      return true;
    } else {
      return false;
    }
  };

  this.purge_default = function() {
    if (window.Modernizr.localstorage) {
      window.localStorage['dashboard'] = '';
      return true;
    } else {
      return false;
    }
  };

  // TOFIX: Pretty sure this breaks when you're on a saved dashboard already
  this.share_link = function(title,type,id) {
    return {
      location  : window.location.href.replace(window.location.hash,""),
      type      : type,
      id        : id,
      link      : window.location.href.replace(window.location.hash,"")+"#dashboard/"+type+"/"+id,
      title     : title
    };
  };

  this.file_load = function(file) {
    return $http({
      url: "dashboards/"+file,
      method: "GET",
    }).then(function(result) {
      var _dashboard = result.data;
      _.defaults(_dashboard,_dash);
      self.dash_load(_dashboard);
      return true;
    },function(result) {
      alertSrv.set('Error',"Could not load <i>dashboards/"+file+"</i>. Please make sure it exists" ,'error');
      return false;
    });
  };


  this.elasticsearch_load = function(type,id) {
    return $http({
      url: config.elasticsearch + "/" + config.kibana_index + "/"+type+"/"+id,
      method: "GET"
    }).error(function(data, status, headers, conf) {
      if(status === 0) {
        alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
          ". Please ensure that Elasticsearch is reachable from your system." ,'error');
      } else {
        alertSrv.set('Error',"Could not find "+id+". If you"+
          " are using a proxy, ensure it is configured correctly",'error');
      }
      return false;
    }).success(function(data, status, headers) {
      self.dash_load(angular.fromJson(data['_source']['dashboard']));
    });
  };

  this.elasticsearch_save = function(type,title,ttl) {
    // Clone object so we can modify it without influencing the existing obejct
    var save = _.clone(self.current);
    var id;

    // Change title on object clone
    if (type === 'dashboard') {
      id = save.title = _.isUndefined(title) ? self.current.title : title;
    }

    // Create request with id as title. Rethink this.
    var request = ejs.Document(config.kibana_index,type,id).source({
      user: 'guest',
      group: 'guest',
      title: save.title,
      dashboard: angular.toJson(save)
    });

    request = type === 'temp' && ttl ? request.ttl(ttl) : request;

    return request.doIndex(
      // Success
      function(result) {
        return result;
      },
      // Failure
      function(result) {
        return false;
      }
    );
  };

  this.elasticsearch_delete = function(id) {
    return ejs.Document(config.kibana_index,'dashboard',id).doDelete(
      // Success
      function(result) {
        return result;
      },
      // Failure
      function(result) {
        return false;
      }
    );
  };

  this.elasticsearch_list = function(query,count) {
    var request = ejs.Request().indices(config.kibana_index).types('dashboard');
    return request.query(
      ejs.QueryStringQuery(query || '*')
      ).size(count).doSearch(
        // Success
        function(result) {
          return result;
        },
        // Failure
        function(result) {
          return false;
        }
      );
  };

  // TOFIX: Gist functionality
  this.save_gist = function(title,dashboard) {
    var save = _.clone(dashboard || self.current);
    save.title = title || self.current.title;
    return $http({
      url: "https://api.github.com/gists",
      method: "POST",
      data: {
        "description": save.title,
        "public": false,
        "files": {
          "kibana-dashboard.json": {
            "content": angular.toJson(save,true)
          }
        }
      }
    }).then(function(data, status, headers, config) {
      return data.data.html_url;
    }, function(data, status, headers, config) {
      return false;
    });
  };

  this.gist_list = function(id) {
    return $http.jsonp("https://api.github.com/gists/"+id+"?callback=JSON_CALLBACK"
    ).then(function(response) {
      var files = [];
      _.each(response.data.data.files,function(v,k) {
        try {
          var file = JSON.parse(v.content);
          files.push(file);
        } catch(e) {
          // Nothing?
        }
      });
      return files;
    }, function(data, status, headers, config) {
      return false;
    });
  };
});