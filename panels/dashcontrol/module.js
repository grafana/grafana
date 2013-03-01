angular.module('kibana.dashcontrol', [])
.controller('dashcontrol', function($scope, $routeParams, $http, eventBus, timer) {
  $scope.panel = $scope.panel || {};
  // Set and populate defaults
  var _d = {
    group   : "default",
    save : {
      gist: true,
      elasticsearch: true,
      local: true,
      'default': true
    },
    load : {
      gist: true,
      elasticsearch: true,
      local: true,
    },
    elasticsearch_size: 20,
    elasticsearch_saveto: $scope.config.kibana_index,
    temp_ttl: '30d',
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    // A hash of defaults for the dashboard object
    var _dash = {
      title: "",
      editable: true,
      rows: [],
    }

    // Long ugly if statement for figuring out which dashboard to load on init
    // If there is no dashboard defined, find one
    if(_.isUndefined($scope.dashboards)) {
      // First check the URL for a path to a dashboard
      if(!(_.isUndefined($routeParams.type)) && !(_.isUndefined($routeParams.id))) {
        var _type = $routeParams.type;
        var _id = $routeParams.id;
        
        if(_type === 'elasticsearch')
          $scope.elasticsearch_load('dashboard',_id)
        if(_type === 'temp')
          $scope.elasticsearch_load('temp',_id)
          
      // No dashboard in the URL
      } else {
        // Check if browser supports localstorage, and if there's a dashboard 
        if (Modernizr.localstorage && 
          !(_.isUndefined(localStorage['dashboard'])) &&
          localStorage['dashboard'] !== ''
        ) {
          var dashboard = JSON.parse(localStorage['dashboard']);
          _.defaults(dashboard,_dash);
          $scope.dash_load(JSON.stringify(dashboard))
        // No? Ok, grab default.json, its all we have now
        } else {
          $http({
            url: "default.json",
            method: "GET",
          }).success(function(data, status, headers, config) {
            var dashboard = data
             _.defaults(dashboard,_dash);
             $scope.dash_load(JSON.stringify(dashboard))
          }).error(function(data, status, headers, config) {
            $scope.alert('Default dashboard missing!','Could not locate default.json','error')
          });
        }
        
      }
    }

    $scope.gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
    $scope.gist = {};
    $scope.elasticsearch = {};
  }

  $scope.export = function() {
    var blob = new Blob([angular.toJson($scope.dashboards,true)], {type: "application/json;charset=utf-8"});
    saveAs(blob, $scope.dashboards.title+"-"+new Date().getTime());
  }

  $scope.default = function() {
    if (Modernizr.localstorage) {
      localStorage['dashboard'] = angular.toJson($scope.dashboards);
      $scope.alert('Success',
        $scope.dashboards.title + " has been set as your default dashboard",
        'success',5000)
    } else {
      $scope.alert('Bummer!',
        "Your browser is too old for this functionality",
        'error',5000);
    }  
  }

  $scope.share_link = function(title,type,id) {
    $scope.share = {
      location  : location.href.replace(location.hash,""),
      type      : type,
      id        : id,
      link      : location.href.replace(location.hash,"")+"#dashboard/"+type+"/"+id,
      title     : title,
    };
  }

  $scope.purge = function() {
    if (Modernizr.localstorage) {
      localStorage['dashboard'] = '';
      $scope.alert('Success',
        'Default dashboard cleared',
        'success',5000)
    } else {
      $scope.alert('Doh!',
        "Your browser is too old for this functionality",
        'error',5000);
    }  
  }

  $scope.elasticsearch_save = function(type) {
    // Clone object so we can modify it without influencing the existing obejct
    var save = _.clone($scope.dashboards)
    
    // Change title on object clone
    if(type === 'dashboard')
      var id = save.title = $scope.elasticsearch.title;

    // Create request with id as title. Rethink this.
    var request = $scope.ejs.Document($scope.panel.elasticsearch_saveto,type,id).source({
      user: 'guest',
      group: 'guest',
      title: save.title,
      dashboard: angular.toJson(save)
    })
    
    if(type === 'temp')
      request = request.ttl($scope.panel.temp_ttl)

    var result = request.doIndex();
    var id = result.then(function(result) {
      $scope.alert('Dashboard Saved','This dashboard has been saved to Elasticsearch','success',5000)
      $scope.elasticsearch_dblist($scope.elasticsearch.query);
      $scope.elasticsearch.title = '';
      if(type === 'temp')
        $scope.share_link($scope.dashboards.title,'temp',result._id)
    })
  }

  $scope.elasticsearch_delete = function(dashboard) {
    var result = $scope.ejs.Document($scope.panel.elasticsearch_saveto,'dashboard',dashboard._id).doDelete();
    result.then(function(result) {
      $scope.alert('Dashboard Deleted','','success',5000)
      $scope.elasticsearch.dashboards = _.without($scope.elasticsearch.dashboards,dashboard)
    })
  }

  $scope.elasticsearch_load = function(type,id) {
    var request = $scope.ejs.Request().indices($scope.panel.elasticsearch_saveto).types(type);
    var results = request.query(
        $scope.ejs.IdsQuery(id)
        ).size($scope.panel.elasticsearch_size).doSearch();
    results.then(function(results) {
      if(_.isUndefined(results)) {
        $scope.panel.error = 'Your query was unsuccessful';
        return;
      }
      $scope.panel.error =  false;
      $scope.dash_load(results.hits.hits[0]['_source']['dashboard'])
    });
  }

  $scope.elasticsearch_dblist = function(query) {
    if($scope.panel.load.elasticsearch) {
      var request = $scope.ejs.Request().indices($scope.panel.elasticsearch_saveto).types('dashboard');
      var results = request.query(
        $scope.ejs.QueryStringQuery(query || '*')
        ).size($scope.panel.elasticsearch_size).doSearch();
      results.then(function(results) {
        if(_.isUndefined(results)) {
          $scope.panel.error = 'Your query was unsuccessful';
          return;
        }
        $scope.panel.error =  false;
        $scope.hits = results.hits.total;
        $scope.elasticsearch.dashboards = results.hits.hits
      });
    }
  }

  $scope.save_gist = function() {
    var save = _.clone($scope.dashboards)
    save.title = $scope.gist.title;
    $http({
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
    }).success(function(data, status, headers, config) {
      $scope.gist.last = data.html_url;
      $scope.alert('Gist saved','You will be able to access your exported dashboard file at <a href="'+data.html_url+'">'+data.html_url+'</a> in a moment','success')
    }).error(function(data, status, headers, config) {
      $scope.alert('Unable to save','Save to gist failed for some reason','error',5000)
    });
  }

  $scope.gist_dblist = function(id) {
    $http({
    url: "https://api.github.com/gists/"+id,
    method: "GET"
    }).success(function(data, status, headers, config) {
      $scope.gist.files = []
      _.each(data.files,function(v,k) {
        try {
          var file = JSON.parse(v.content)
          $scope.gist.files.push(file)
        } catch(e) {
          $scope.alert('Gist failure','The dashboard file is invalid','warning',5000)
        }
      });
    }).error(function(data, status, headers, config) {
      $scope.alert('Gist Failed','Could not retrieve dashboard list from gist','error',5000)
    });
  }

  $scope.dash_load = function(dashboard) {
    if(!_.isObject(dashboard))
      dashboard = JSON.parse(dashboard)

    eventBus.broadcast($scope.$id,'ALL','dashboard',dashboard)
    timer.cancel_all();
  }

  $scope.gist_id = function(string) {
    if($scope.is_gist(string))
      return string.match($scope.gist_pattern)[0].replace(/.*\//, '');
  }

  $scope.is_gist = function(string) {
    if(!_.isUndefined(string) && string != '' && !_.isNull(string.match($scope.gist_pattern)))
      return string.match($scope.gist_pattern).length > 0 ? true : false;
    else
      return false
  }

  $scope.init();


})
.directive('dashUpload', function(timer, eventBus){
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      function file_selected(evt) {
        var files = evt.target.files; // FileList object

        // files is a FileList of File objects. List some properties.
        var output = [];
        for (var i = 0, f; f = files[i]; i++) {
          var reader = new FileReader();
          reader.onload = (function(theFile) {
            return function(e) {
              scope.dash_load(JSON.parse(e.target.result))
              scope.$apply();
            };
          })(f);
          reader.readAsText(f);
        }
      }

      // Check for the various File API support.
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Something
        document.getElementById('dashupload').addEventListener('change', file_selected, false);
      } else {
        alert('Sorry, the HTML5 File APIs are not fully supported in this browser.');
      }
    }
  }
}).filter('gistid', function() {
    var gist_pattern = /(\d{5,})|([a-z0-9]{10,})|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
    return function(input, scope) {
        //return input+"boners"
        if(!(_.isUndefined(input))) {
          var output = input.match(gist_pattern);
          if(!_.isNull(output) && !_.isUndefined(output))
            return output[0].replace(/.*\//, '');
        }
    }
});;