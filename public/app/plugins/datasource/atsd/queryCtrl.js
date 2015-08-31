define([
    'angular',
    'lodash',
    'kbn'
],
function (angular, _, kbn) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AtsdQueryCtrl', function($scope, $timeout) {

        $scope.init = function() { //DONE
            $scope.temp = {};

            $scope.statistics = {
                'Detail'                : 'detail',
                'Count'                 : 'count',
                'Minimum'               : 'min',
                'Maximum'               : 'max',
                'Average'               : 'avg',
                'Median'                : 'median',
                'Sum'                   : 'sum',
                'Percentile 99.9%'      : 'percentile_999',
                'Percentile 99.5%'      : 'percentile_995',
                'Percentile 99%'        : 'percentile_99',
                'Percentile 95%'        : 'percentile_95',
                'Percentile 90%'        : 'percentile_90',
                'Percentile 75%'        : 'percentile_75',
                'First value'           : 'first',
                'Last value'            : 'last',
                'Delta'                 : 'delta',
                'Weighted average'      : 'wavg',
                'Weighted time average' : 'wtavg',
                'Standard deviation'    : 'standard_deviation'
            };
            $scope.statisticIds = Object.keys($scope.statistics);

            $scope.oldTarget = angular.copy($scope.target);
            $scope.targetBlur();
        };

        $scope.targetBlur = function() { //DONE
            $scope.errors = validateTarget($scope.target);

            console.log('errors: ' + JSON.stringify($scope.errors));

            if (_.isEmpty($scope.errors)) {
                $scope.oldTarget = angular.copy($scope.target);
                $scope.get_data();
            }
        };

        $scope.duplicate = function() { //DONE
            var clone = angular.copy($scope.target);
            $scope.panel.targets.push(clone);
        };

        $scope.renewTags = function() { //DONE
            $scope.datasource.getTags($scope.target.entity, $scope.target.metric).then(function(result) {
                $scope.target.tagCombos = _.map(result, function(element) {
                    return {en : true, data : element};
                });
                
                $scope.target.tagCombosAll = true;
            });
        };
        
        $scope.checkAll = function() { //DONE
            if ($scope.target.tagCombos !== undefined) {
                _.each($scope.target.tagCombos, function(tags){
                    tags.en = $scope.target.tagCombosAll;
                });
            }
        };
        
        $scope.dropCache = function() { //DONE
            $scope.datasource.dropCache();
        };
        
        $scope.suggestEntites = function(query, callback) { //DONE
            $scope.datasource
                .suggestEntities(query)
                .then(callback);
        };
        
        $scope.suggestMetrics = function(query, callback) { //DONE
            $scope.datasource
                .suggestMetrics($scope.target.entity, query)
                .then(callback);
        };
        
        $scope.suggestNextSegment = function(query, callback) { //DONE
            $scope.datasource
                .suggestNextSegment($scope.target.entity, $scope.target.segments)
                .then(callback);
        };
        
        $scope.addSegment = function() { //DONE
            $scope.target.segments = $scope.target.segments !== undefined ?
                                     $scope.target.segments :
                                     [];
            
            if ($scope.temp.currentSegment !== undefined && $scope.temp.currentSegment !== '') {
                $scope.target.segments.push($scope.temp.currentSegment);
                $scope.temp.currentSegment = '';
            }
        };

        $scope.removeSegment = function() { //DONE
            if ($scope.target.segments !== undefined && $scope.target.segments.length !== 0) {
                $scope.target.segments.splice($scope.target.segments.length - 1, 1);
            }
        };

        $scope.metricToSegments = function() { //DONE
            $scope.target.segments = $scope.target.metric !== undefined ?
                                     $scope.target.metric.split('.') :
                                     [];
            $scope.renewTags();
        };

        $scope.segmentsToMetric = function() { //DONE
            $scope.addSegment();
            $scope.temp.currentSegment = '';

            var tempMetric = $scope.target.segments.join('.');

            if ($scope.target.metric !== tempMetric) {
                $scope.target.metric = tempMetric;
                $scope.renewTags();
            }
        };

        $scope.suggestTagKeys = function(query, callback) { //DONE
            $scope.datasource
                .suggestTagKeys($scope.target.entity,
                                $scope.target.metric,
                                $scope.target.tags)
                .then(callback);
        };

        $scope.suggestTagValues = function(query, callback) { //DONE
            $scope.datasource
                .suggestTagValues($scope.target.entity,
                                  $scope.target.metric,
                                  $scope.target.tags,
                                  $scope.temp.currentTagKey)
                .then(callback);
        };

        $scope.addTag = function() { //DONE
            if (!$scope.addTagMode) {
                $scope.addTagMode = true;
                return;
            }

            if (!$scope.target.tags) {
                $scope.target.tags = {};
            }

            $scope.target.tags[$scope.temp.currentTagKey] = $scope.temp.currentTagValue;
            $scope.temp.currentTagKey = '';
            $scope.temp.currentTagValue = '';

            $scope.addTagMode = false;
        };

        $scope.removeTag = function(key) { //DONE
            delete $scope.target.tags[key];
        };
        
        function isValid(string) { //DONE
            if (string !== undefined && string !== '') {
                return true;
            }
            return false;
        }
        
        function isDetail(statistic) { //DONE
            if (statistic === undefined || statistic === 'detail') {
                return true;
            }
            return false;
        }

        function validateTarget(target) { //DONE
            var errs = [];
            
            if (!isValid(target.entity)) {
                errs.push('No entity specified');
            }
            
            if (!isValid(target.metric)) {
                errs.push('No metric specified');
            }
            
            if (!isDetail(target.statistic) &&
                !isValid(target.period)) {
                errs.push('No valid period');
            }
            
            return errs;
        }

        $scope.init();
    });

});