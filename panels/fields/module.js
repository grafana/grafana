angular.module('kibana.fields', [])
.controller('fields', function($scope, eventBus, $timeout) {

  // Set and populate defaults
  var _d = {
    group   : "default",
    style   : {},
    arrange : 'vertical',
    micropanel_position : 'right', 
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.Math = Math;
    $scope.fields = [];
    eventBus.register($scope,'fields', function(event, fields) {
      $scope.panel.sort = _.clone(fields.sort);
      $scope.fields     = fields.all,
      $scope.active     = _.clone(fields.active);
    });
    eventBus.register($scope,'table_documents', function(event, docs) {
      $scope.panel.query = docs.query;
      $scope.docs = docs.docs;
    });
  }

  $scope.reload_list = function () {
    var temp = _.clone($scope.fields);
    $scope.fields = []    
    $timeout(function(){
      $scope.fields = temp;
    },10)
    
  }

  $scope.toggle_micropanel = function(field) {
    $scope.micropanel = {
      field: field,
      values : top_field_values($scope.docs,field,10),
      related : get_related_fields($scope.docs,field),
      count: _.countBy($scope.docs,function(doc){
        return _.contains(_.keys(doc),field)})['true'],
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

  $scope.build_search = function(field, value,negate) {
    $scope.panel.query = add_to_query($scope.panel.query,field,value,negate)
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',$scope.panel.query);
  }

  $scope.is_active = function(field) {
    return _.indexOf($scope.active,field) > -1 ? ['label','label-info'] : '';    
  }

  $scope.init();
})