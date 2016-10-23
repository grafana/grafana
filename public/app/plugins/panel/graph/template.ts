var template = `
<div class="graph-wrapper" ng-class="{'graph-legend-rightside': ctrl.panel.legend.rightSide}">
  <div class="graph-canvas-wrapper">

    <div class="datapoints-warning" ng-show="ctrl.datapointsCount===0">
      <span class="small" >
        No datapoints <tip>No datapoints returned from metric query</tip>
      </span>
    </div>

    <div class="datapoints-warning" ng-show="ctrl.datapointsOutside">
      <span class="small">
        Datapoints outside time range
        <tip>Can be caused by timezone mismatch between browser and graphite server</tip>
      </span>
    </div>

    <div grafana-graph class="histogram-chart" ng-dblclick="ctrl.zoomOut()">
    </div>

  </div>

  <div class="graph-legend-wrapper" graph-legend></div>
  </div>

<div class="clearfix"></div>
`;

export default template;


