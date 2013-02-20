angular.module('kibana.fields', [])
.controller('fields', function($scope, eventBus) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    group   : "default",
    style   : {},
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.fields = [];
    eventBus.register($scope,'fields', function(event, fields) {
      $scope.panel.sort = _.clone(fields.sort);
      $scope.fields     = _.union(fields.all,$scope.fields);
      $scope.active     = _.clone(fields.active);
    });
    eventBus.register($scope,'table_documents', function(event, docs) {
      $scope.panel.query = docs.query;
      $scope.docs = docs.docs;
    });
  }

  $scope.toggle_micropanel = function(field) {
    //console.log(top_field_values($scope.docs,field,10))
    $scope.micropanel = {
      field: field,
      values : top_field_values($scope.docs,field,10)
    }
  }

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
  }

  $scope.toggle_field = function(field) {
    if (_.indexOf($scope.active,field) > -1) 
      $scope.active = _.without($scope.active,field)
    else
      $scope.active.push(field)
    
    eventBus.broadcast($scope.$id,$scope.panel.group,"selected_fields",$scope.active)
  }

  $scope.build_search = function(field, value) {
    var query = field + ":" + "\"" + addslashes(value.toString()) + "\"";
    var glue = $scope.panel.query != "" ? " AND " : "";
    $scope.panel.query = $scope.panel.query + glue + query;
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',$scope.panel.query);
  }

  $scope.is_active = function(field) {
    return _.indexOf($scope.active,field) > -1 ? ['label','label-info'] : '';    
  }

  $scope.init();
})