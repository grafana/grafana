define([
    'angular',
    'lodash',
    'ng-quill'
  ],
  function (angular, _, ngQuill) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('CreateKnowledgeCtrl', function ($scope, backendSrv, contextSrv) {
      $scope.init = function () {
        $scope.check = { symptom: false, solution: false };
        $scope.knowledge = {};
        $scope.knowledge.symptom = "";
        $scope.knowledge.solution = "";
        $scope.knowledge.service = "*";

        $scope.toolbarOptions = [
          ['bold'],        // toggled buttons
          ['blockquote', 'code-block'],

          [{ 'header': 1 }, { 'header': 2 }],               // custom button values
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent

          ['clean']                                         // remove formatting button
        ];
      };

      $scope.new = function() {
        console.log($scope.knowledge);
        $scope.knowledge.org_id = contextSrv.user.orgId;
        $scope.knowledge.system_id = contextSrv.user.systemId;
        if(_.every($scope.check)) {
          backendSrv.knowledge({
            method: "PUT",
            url: "",
            data: $scope.knowledge
          }).then(function(res) {
            if(res.data.isSuccessful) {
              $scope.appEvent('alert-success', ['添加成功']);
              $scope.dismiss();
            }
          });
        } else {
          $scope.appEvent('alert-warning', ['请输入有效信息']);
        }
      };

      $scope.selectionChanged = function(editor, range, oldRange, source) {
        if(oldRange && oldRange.index) {
          $scope.check[source] = true;
        } else {
          $scope.check[source] = false;
        }
      };

    });
  });
