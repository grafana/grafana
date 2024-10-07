mxTooltipHandler.prototype.show = function(tip, x, y) {
  // u.log(1, 'mxTooltipHandler.prototype.show()');

  // TYPE STRING
    if ( this.destroyed) return;
    if (tip == null) return;
    if ( tip.length == 0) return;
    // Initializes the DOM nodes if required
    if (this.div == null) {
      this.init();
    }
    if (!mxUtils.isNode(tip)) {
      this.div.innerHTML = tip.replace(/\n/g, '<br>');
    } else {
      this.div.innerHTML = '';
      this.div.appendChild(tip);
    }
    this.$div.place_tt(x + 20, y);
    this.div.style.visibility = '';
    mxUtils.fit(this.div);
};

mxTooltipHandler.prototype.init = function() {
  // u.log(1, 'mxTooltipHandler.prototype.init()');
  if (this.div === null || this.div === undefined) {
    this.$div = $('<div class="graph-tooltip">');
    this.div = this.$div[0];
    mxEvent.addGestureListeners(
      this.div,
      mxUtils.bind(this, function(evt) {
        this.hideTooltip();
      })
    );
  }
};

mxTooltipHandler.prototype.hideTooltip = function() {
  if (this.div != null) {
    this.div.style.visibility = 'hidden';
    this.div.innerHTML = '';
  }
};

mxEvent.addMouseWheelListener = function(func, container) {
  if (null != func) {
    var c = function(container) {
      null == container && (container = window.event);
      var c;
      c = mxClient.IS_FF ? -container.detail / 2 : container.wheelDelta / 120;
      0 != c && func(container, 0 < c);
    };
    mxClient.IS_NS && null == document.documentMode
      ? mxEvent.addListener(
          mxClient.IS_GC && null != container ? container : window,
          mxClient.IS_SF || mxClient.IS_GC ? 'mousewheel' : 'DOMMouseScroll',
          c
        )
      : mxEvent.addListener(document, 'mousewheel', c);
  }
};

mxStencilRegistry.libraries.mockup = [SHAPES_PATH + '/mockup/mxMockupButtons.js'];
mxStencilRegistry.libraries.arrows2 = [SHAPES_PATH + '/mxArrows.js'];
mxStencilRegistry.libraries.atlassian = [
  STENCIL_PATH + '/atlassian.xml',
  SHAPES_PATH + '/mxAtlassian.js'
];
mxStencilRegistry.libraries.bpmn = [
  SHAPES_PATH + '/bpmn/mxBpmnShape2.js',
  STENCIL_PATH + '/bpmn.xml'
];
mxStencilRegistry.libraries.dfd = [SHAPES_PATH + '/mxDFD.js'];
mxStencilRegistry.libraries.er = [SHAPES_PATH + '/er/mxER.js'];
mxStencilRegistry.libraries.flowchart = [
  SHAPES_PATH + '/mxFlowchart.js',
  STENCIL_PATH + '/flowchart.xml'
];
mxStencilRegistry.libraries.ios = [SHAPES_PATH + '/mockup/mxMockupiOS.js'];
mxStencilRegistry.libraries.rackGeneral = [
  SHAPES_PATH + '/rack/mxRack.js',
  STENCIL_PATH + '/rack/general.xml'
];
mxStencilRegistry.libraries.rackF5 = [STENCIL_PATH + '/rack/f5.xml'];
mxStencilRegistry.libraries.lean_mapping = [
  SHAPES_PATH + '/mxLeanMap.js',
  STENCIL_PATH + '/lean_mapping.xml'
];
mxStencilRegistry.libraries.basic = [SHAPES_PATH + '/mxBasic.js', STENCIL_PATH + '/basic.xml'];
mxStencilRegistry.libraries.ios7icons = [STENCIL_PATH + '/ios7/icons.xml'];
mxStencilRegistry.libraries.ios7ui = [
  SHAPES_PATH + '/ios7/mxIOS7Ui.js',
  STENCIL_PATH + '/ios7/misc.xml'
];
mxStencilRegistry.libraries.android = [
  SHAPES_PATH + '/mxAndroid.js',
  STENCIL_PATH + '/android/android.xml'
];
mxStencilRegistry.libraries['electrical/miscellaneous'] = [
  SHAPES_PATH + '/mxElectrical.js',
  STENCIL_PATH + '/electrical/miscellaneous.xml'
];
mxStencilRegistry.libraries['electrical/transmission'] = [
  SHAPES_PATH + '/mxElectrical.js',
  STENCIL_PATH + '/electrical/transmission.xml'
];
mxStencilRegistry.libraries['electrical/logic_gates'] = [
  SHAPES_PATH + '/mxElectrical.js',
  STENCIL_PATH + '/electrical/logic_gates.xml'
];
mxStencilRegistry.libraries['electrical/abstract'] = [
  SHAPES_PATH + '/mxElectrical.js',
  STENCIL_PATH + '/electrical/abstract.xml'
];
mxStencilRegistry.libraries.infographic = [SHAPES_PATH + '/mxInfographic.js'];
mxStencilRegistry.libraries['mockup/buttons'] = [SHAPES_PATH + '/mockup/mxMockupButtons.js'];
mxStencilRegistry.libraries['mockup/containers'] = [SHAPES_PATH + '/mockup/mxMockupContainers.js'];
mxStencilRegistry.libraries['mockup/forms'] = [SHAPES_PATH + '/mockup/mxMockupForms.js'];
mxStencilRegistry.libraries['mockup/graphics'] = [
  SHAPES_PATH + '/mockup/mxMockupGraphics.js',
  STENCIL_PATH + '/mockup/misc.xml'
];
mxStencilRegistry.libraries['mockup/markup'] = [SHAPES_PATH + '/mockup/mxMockupMarkup.js'];
mxStencilRegistry.libraries['mockup/misc'] = [
  SHAPES_PATH + '/mockup/mxMockupMisc.js',
  STENCIL_PATH + '/mockup/misc.xml'
];
mxStencilRegistry.libraries['mockup/navigation'] = [
  SHAPES_PATH + '/mockup/mxMockupNavigation.js',
  STENCIL_PATH + '/mockup/misc.xml'
];
mxStencilRegistry.libraries['mockup/text'] = [SHAPES_PATH + '/mockup/mxMockupText.js'];
mxStencilRegistry.libraries.floorplan = [
  SHAPES_PATH + '/mxFloorplan.js',
  STENCIL_PATH + '/floorplan.xml'
];
mxStencilRegistry.libraries.bootstrap = [
  SHAPES_PATH + '/mxBootstrap.js',
  STENCIL_PATH + '/bootstrap.xml'
];
mxStencilRegistry.libraries.gmdl = [SHAPES_PATH + '/mxGmdl.js', STENCIL_PATH + '/gmdl.xml'];
mxStencilRegistry.libraries.gcp2 = [SHAPES_PATH + '/mxGCP2.js', STENCIL_PATH + '/gcp2.xml'];
mxStencilRegistry.libraries.cabinets = [
  SHAPES_PATH + '/mxCabinets.js',
  STENCIL_PATH + '/cabinets.xml'
];
mxStencilRegistry.libraries.archimate = [SHAPES_PATH + '/mxArchiMate.js'];
mxStencilRegistry.libraries.archimate3 = [SHAPES_PATH + '/mxArchiMate3.js'];
mxStencilRegistry.libraries.sysml = [SHAPES_PATH + '/mxSysML.js'];
mxStencilRegistry.libraries.eip = [SHAPES_PATH + '/mxEip.js', STENCIL_PATH + '/eip.xml'];
mxStencilRegistry.libraries.networks = [
  SHAPES_PATH + '/mxNetworks.js',
  STENCIL_PATH + '/networks.xml'
];
mxStencilRegistry.libraries.aws3d = [SHAPES_PATH + '/mxAWS3D.js', STENCIL_PATH + '/aws3d.xml'];
mxStencilRegistry.libraries.aws4 = [SHAPES_PATH + '/mxAWS4.js', STENCIL_PATH + '/aws4.xml'];
mxStencilRegistry.libraries.aws4b = [SHAPES_PATH + '/mxAWS4.js', STENCIL_PATH + '/aws4.xml'];
mxStencilRegistry.libraries.veeam = [
  STENCIL_PATH + '/veeam/2d.xml',
  STENCIL_PATH + '/veeam/3d.xml',
  STENCIL_PATH + '/veeam/veeam.xml'
];
mxStencilRegistry.libraries.pid2inst = [SHAPES_PATH + '/pid2/mxPidInstruments.js'];
mxStencilRegistry.libraries.pid2misc = [
  SHAPES_PATH + '/pid2/mxPidMisc.js',
  STENCIL_PATH + '/pid/misc.xml'
];
mxStencilRegistry.libraries.pid2valves = [SHAPES_PATH + '/pid2/mxPidValves.js'];
mxStencilRegistry.libraries.pidFlowSensors = [STENCIL_PATH + '/pid/flow_sensors.xml'];
