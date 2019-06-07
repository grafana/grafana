const template = `
<div class="graph-panel" ng-class="{'graph-panel--legend-right': ctrl.panel.legend.rightSide}">
  <div class="graph-panel__chart" grafana-graph ng-dblclick="ctrl.zoomOut()">
  </div>

  <div class="graph-legend">
    <div class="graph-legend-content" graph-legend></div>
  </div>
  <div ng-if="ctrl.contextMenuCtrl.isVisible">
    <graph-context-menu
      items="ctrl.contextMenuCtrl.menuItems"
      onClose="ctrl.onContextMenuClose"
      getContextMenuSource="ctrl.contextMenuCtrl.getSource"
      x="ctrl.contextMenuCtrl.position.x"
      y="ctrl.contextMenuCtrl.position.y"
    ></graph-context-menu>
  </div>
</div>
`;

export default template;
