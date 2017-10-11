var template = `
<div class="graph-wrapper" ng-class="{'graph-legend-rightside': ctrl.panel.legend.rightSide}">
  <div class="graph-canvas-wrapper">

    <div class="datapoints-warning" ng-if="ctrl.dataWarning">
      <span class="small" bs-tooltip="ctrl.dataWarning.tip">{{ctrl.dataWarning.title}}</span>
    </div>

    <div grafana-graph class="histogram-chart" ng-dblclick="ctrl.zoomOut()">
    </div>

  </div>

  <div class="graph-legend-wrapper" graph-legend></div>
  </div>

<div class="clearfix"></div>
`;

export default template;


