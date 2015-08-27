define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('OpenNMSQueryCtrl', function ($scope, $q, $modal) {

      $scope.init = function () {
        $scope.aggregation = ['AVERAGE', 'MIN', 'MAX', 'LAST'];

        if (!$scope.target.aggregation) {
          $scope.target.aggregation = 'AVERAGE';
        }

        if (!$scope.target.type) {
          $scope.target.type = 'attribute';
        }

        $scope.target.error = validateTarget($scope.target);
      };

      $scope.targetBlur = function () {
        $scope.target.error = validateTarget($scope.target);

        // this does not work so good
        if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
          $scope.oldTarget = angular.copy($scope.target);
          $scope.get_data();
        }
      };

      $scope.openNodeSelectionModal = function () {
        var modalScope = $scope.$new(true);
        modalScope.search = function (query) {
          return $scope.datasource.searchForNodes(query)
            .then(function (results) {
              return {
                'count': results.count,
                'totalCount': results.totalCount,
                'rows': results.node
              };
            });
        };

        modalScope.deferred = $q.defer();
        modalScope.deferred.promise.then(function (node) {
          if (!_.isUndefined(node.foreignId) && !_.isNull(node.foreignId)
            && !_.isUndefined(node.foreignSource) && !_.isNull(node.foreignSource)) {
            // Prefer fs:fid
            $scope.target.nodeId = node.foreignSource + ":" + node.foreignId;
          } else {
            // Fallback to node id
            $scope.target.nodeId = node.id;
          }
          $scope.targetBlur();
        });

        var nodeSelectionModal = $modal({
          template: './app/plugins/datasource/opennms/partials/node.selection.html',
          persist: true,
          show: false,
          scope: modalScope,
          keyboard: false
        });

        $q.when(nodeSelectionModal).then(function (modalEl) {
          modalEl.modal('show');
        });
      };

      $scope.openResourceSelectionModal = function () {
        var modalScope = $scope.$new(true);
        modalScope.url = $scope.datasource.url;

        function filterResources(resources, query) {
          var filteredResources = resources;
          if (query.length >= 1) {
            query = query.toLowerCase();
            filteredResources = _.filter(resources, function (resource) {
              return resource.key.indexOf(query) >= 0;
            });
          }

          // Limit the results - it takes along time to render if there are too many
          var totalCount = filteredResources.length;
          filteredResources = _.first(filteredResources, $scope.datasource.searchLimit);

          return {
            'count': filteredResources.length,
            'totalCount': totalCount,
            'rows': filteredResources
          };
        }

        $scope.nodeResources = undefined;
        modalScope.search = function (query) {
          if ($scope.nodeResources !== undefined) {
            var deferred = $q.defer();
            deferred.resolve(filterResources($scope.nodeResources, query));
            return deferred.promise;
          }

          return $scope.datasource.getResourcesWithAttributesForNode($scope.target.nodeId)
            .then(function (resources) {
              // Compute a key for more efficient searching
              _.each(resources, function (resource) {
                resource.key = resource.label.toLowerCase() + resource.name.toLowerCase();
              });
              // Sort the list once
              $scope.nodeResources = _.sortBy(resources, function (resource) {
                return resource.label;
              });
              // Filter
              return filterResources(resources, query);
            });
        };

        modalScope.deferred = $q.defer();
        modalScope.deferred.promise.then(function (resource) {
          // Exclude the node portion of the resource id
          var re = /node(Source)?\[.*?]\.(.*)$/;
          var match = re.exec(resource.id);
          $scope.target.resourceId = match[2];
          $scope.targetBlur();
        });

        var resourceSelectionModal = $modal({
          template: './app/plugins/datasource/opennms/partials/resource.selection.html',
          persist: true,
          show: false,
          scope: modalScope,
          keyboard: false
        });

        $q.when(resourceSelectionModal).then(function (modalEl) {
          modalEl.modal('show');
        });
      };

      $scope.openAttributeSelectionModal = function () {
        var modalScope = $scope.$new(true);
        modalScope.search = function (query) {
          // TODO: There's no need to keep going back to the server every time to get the list of attributes
          return $scope.datasource
            .suggestAttributes($scope.target.nodeId, $scope.target.resourceId, query)
            .then(function (attributes) {
              return {
                'count': attributes.length,
                'totalCount': attributes.length,
                'rows': attributes
              };
            });
        };

        modalScope.deferred = $q.defer();
        modalScope.deferred.promise.then(function (attribute) {
          $scope.target.attribute = attribute;
          $scope.targetBlur();
        });

        var attributeSelectionModal = $modal({
          template: './app/plugins/datasource/opennms/partials/attribute.selection.html',
          persist: true,
          show: false,
          scope: modalScope,
          keyboard: false
        });

        $q.when(attributeSelectionModal).then(function (modalEl) {
          modalEl.modal('show');
        });
      };

      $scope.duplicate = function () {
        var clone = angular.copy($scope.target);
        $scope.panel.targets.push(clone);
      };

      $scope.suggestResourceIds = function (query, callback) {
        $scope.datasource
          .suggestResourceIds(query)
          .then(callback);
      };

      $scope.suggestAttributes = function (query, callback) {
        $scope.datasource
          .suggestAttributes($scope.target.resourceid, query)
          .then(callback);
      };

      function validateTarget(target) {
        if (target.type === "attribute") {
          if (!target.nodeId) {
            return "You must supply a node id.";
          } else if (!target.resourceId) {
            return "You must supply a resource id.";
          } else if (!target.attribute) {
            return "You must supply an attribute.";
          }
        } else if (target.type === "expression") {
          if (!target.label) {
            return "You must supply a label.";
          } else if (!target.expression) {
            return "You must supply an expression.";
          }
        } else {
          return "Invalid type.";
        }

        return undefined;
      }
    });

  });