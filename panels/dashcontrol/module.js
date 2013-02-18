angular.module('kibana.dashcontrol', [])
.controller('dashcontrol', function($scope, $http, eventBus, timer) {

  var _id = _.uniqueId();

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
    elasticsearch_saveto: 'kibana-int'
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
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

  $scope.save_elasticsearch = function() {
    var save = _.clone($scope.dashboards)
    save.title = $scope.elasticsearch.title;
    var result = $scope.ejs.Document($scope.panel.elasticsearch_saveto,'dashboard',save.title).source({
      user: 'guest',
      group: 'guest',
      title: save.title,
      dashboard: angular.toJson(save)
    }).doIndex();
    result.then(function(result) {
      $scope.alert('Dashboard Saved','This dashboard has been saved to Elasticsearch','success',5000)
      $scope.elasticsearch_dblist($scope.elasticsearch.query);
      $scope.elasticsearch.title = '';
    })
  }

  $scope.delete_elasticsearch = function(dashboard) {
    var result = $scope.ejs.Document($scope.panel.elasticsearch_saveto,'dashboard',dashboard._id).doDelete();
    result.then(function(result) {
      $scope.alert('Dashboard Deleted','','success',5000)
      $scope.elasticsearch.dashboards = _.without($scope.elasticsearch.dashboards,dashboard)
    })
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