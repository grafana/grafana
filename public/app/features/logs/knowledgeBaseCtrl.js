define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('KnowledgeBaseCtrl', function ($scope, backendSrv, contextSrv) {
      $scope.init = function () {
        $scope.q = "*";
        $scope.service = "*";
        $scope.services = [
          "*",
          "system",
          "hadoop",
          "hbase",
          "kafka",
          "mysql",
          "spark",
          "storm",
          "yarn",
          "zookeeper",
          "tomcat",
          "opentsdb",
          "mongo3",
          "nginx",
        ];
        $scope.fullText = [];
      };

      $scope.query = function () {
        $scope.showCreatForm = false;
        var params =  {
          q: $scope.q
        }
        if ($scope.service != "*") {
          params.service = $scope.service;
        }
        backendSrv.knowledge({
          method: "GET",
          url: "/search",
          params: params,
        }).then(function (result) {
          $scope.knowledge = result.data;
        });
      };

      $scope.newKnows = function () {
        $scope.appEvent('show-modal', {
          src: 'app/features/logs/partials/new_knowledge.html',
          modalClass: 'modal-no-header invite-modal',
          scope: $scope.$new(),
        });
      };

      $scope.initNewKnows = function () {
        $scope.showCreatForm = true;
        $scope.newKnowledge = {};
        $scope.newKnowledge.solution = "";
        $scope.newKnowledge.service = "";
      };

      $scope.newKnowsByLog = function() {
        $scope.newKnowledge.symptom = $scope.q;
        $scope.newKnowledge.org_id = contextSrv.user.orgId;
        $scope.newKnowledge.system_id = contextSrv.user.systemId;

        backendSrv.knowledge({
          method: "PUT",
          url: "",
          data: $scope.newKnowledge
        }).then(function(res) {
          if(res.data.isSuccessful) {
            $scope.appEvent('alert-success', ['添加成功']);
          }
        });
        $scope.showCreatForm = false;
      };

      $scope.cancelCreate = function() {
        $scope.showCreatForm = false;
      };

      $scope.textOverflow = function(index) {
        $scope.fullText[index] = !$scope.fullText[index];
      };

      $scope.init();
    });
  });
