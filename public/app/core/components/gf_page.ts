import coreModule from 'app/core/core_module';

const template = `
<div class="scroll-canvas">
  <navbar model="model"></navbar>
   <div class="page-container">
		<div class="page-header">
      <h1>
         <i class="{{::model.node.icon}}" ng-if="::model.node.icon"></i>
         <img ng-src="{{::model.node.img}}" ng-if="::model.node.img"></i>
         {{::model.node.text}}
       </h1>

      <div class="page-header__actions" ng-transclude="header"></div>
		</div>

    <div class="page-body" ng-transclude="body">
    </div>
  </div>
</div>
`;

export function gfPageDirective() {
  return {
    restrict: 'E',
    template: template,
    scope: {
      model: '=',
    },
    transclude: {
      header: '?gfPageHeader',
      body: 'gfPageBody',
    },
    link: (scope, elem, attrs) => {
      console.log(scope);
    },
  };
}

coreModule.directive('gfPage', gfPageDirective);
