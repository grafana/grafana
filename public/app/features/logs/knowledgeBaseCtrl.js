define([
    'angular',
    'lodash',
    'ng-quill'
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
        $scope.readOnly = true;
      };

      $scope.query = function () {
        $scope.showList = true;
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

      $scope.editorCreated = function (editor, knowledge, isDetail) {
        if(isDetail) {
          editor.root.innerHTML = knowledge;
        } else {
          var tmp = knowledge.trim();
          var length_txt = tmp.indexOf('\n');
          length_txt = (length_txt > -1 && length_txt < 100) ? length_txt : 100;

          var length_html = tmp.indexOf('</');
          length_html = (length_html > -1 && length_html < 100) ? length_html : 100;

          var length = length_txt < length_html ? length_txt : length_html;
          var end = tmp.length > length ? '...' : '';
          editor.root.innerHTML = tmp.substring(0, length) + end;
        }
      };

      $scope.getDetail = function(knowledge) {
        $scope.showList = false;
        $scope.detailKnowledge = knowledge;
        history.pushState(null, null, document.URL);
        window.addEventListener('popstate', pushState);
      };

      $scope.getList = function() {
        $scope.showList = true;
      };

      $scope.$on("$destroy", function() {
        window.removeEventListener('popstate', pushState);
      });

      // 禁用浏览器后退按钮
      var pushState = function() {
        history.pushState(null, null, document.URL);
      };

      $scope.init();
    });
  });
