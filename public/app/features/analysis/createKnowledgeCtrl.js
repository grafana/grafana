define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('CreateKnowledgeCtrl', function ($scope, backendSrv, contextSrv) {
      $scope.init = function () {
        $scope.knowledge = {};
        $scope.knowledge.symptom = "";
        $scope.knowledge.solution = "";
        $scope.knowledge.service = "";
      };

      $scope.new = function() {
        console.log($scope.knowledge);
        $scope.knowledge.org_id = contextSrv.user.orgId;
        $scope.knowledge.system_id = contextSrv.user.systemId;

        backendSrv.knowledge({
          method: "PUT",
          url: "",
          data: $scope.knowledge
        }).then(function(res) {
          if(res.data.isSuccessful) {
            $scope.appEvent('alert-success', ['添加成功']);
          }
        });
        $scope.dismiss();

      };

    });
  });
