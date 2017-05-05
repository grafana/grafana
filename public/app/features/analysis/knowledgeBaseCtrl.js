define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('KnowledgeBaseCtrl', function ($scope, backendSrv) {
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
      };

      $scope.query = function () {
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
          src: 'app/features/analysis/partials/new_knowledge.html',
          modalClass: 'modal-no-header invite-modal',
          scope: $scope.$new(),
        });
      };

      $scope.init();
    });
  });
