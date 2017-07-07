//TODO update
// 'moment',
// 'app/core/utils/datemath'

// $scope.updateContent = function(html) {
//   try {
//     var scopedVars = _.clone($scope.panel.scopedVars || {});
//     var time = $scope.dashboard.time;
//     var from = "";
//     var to = "";
//     if (moment.isMoment(time.from)) {
//       from = time.from.utc().format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
//       to = time.to.utc().format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
//     } else {
//       from = dateMath.parse(time.from, false).utc().format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
//       to = dateMath.parse(time.to, true).utc().format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
//     }
//     scopedVars['time_from'] = {value: from};
//     scopedVars['time_to'] = {value: to};
//     $scope.content = $sce.trustAsHtml(templateSrv.replace(html, scopedVars));
//   } catch(e) {
//     console.log('Text panel error: ', e);
//     $scope.content = $sce.trustAsHtml(html);
//   }
//
//   if(!$scope.$$phase) {
//     $scope.$digest();
//   }
// };