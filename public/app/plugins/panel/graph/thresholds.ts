///<reference path="../../../headers/common.d.ts" />

import 'jquery.flot';
import $ from 'jquery';
import _ from 'lodash';

export class ThresholdControls {
  plot: any;
  placeholder: any;
  height: any;
  thresholds: any;

  constructor(private panelCtrl) {
    this.thresholds = this.panelCtrl.panel.thresholds;
  }

  getHandleInnerHtml(type, op, value) {
    if (op === '>') { op = '&gt;'; }
    if (op === '<') { op = '&lt;'; }

    return `
    <div class="alert-handle-line">
    </div>
    <div class="alert-handle">
    <i class="icon-gf icon-gf-${type} alert-icon-${type}"></i>
     ${value}
    </div>`;
  }

  getFullHandleHtml(type, op, value) {
    var innerTemplate = this.getHandleInnerHtml(type, op, value);
    return `
    <div class="alert-handle-wrapper alert-handle-wrapper--${type}">
    ${innerTemplate}
    </div>
    `;
  }

  setupDragging(handleElem, threshold) {
    var isMoving = false;
    var lastY = null;
    var posTop;
    var plot = this.plot;
    var panelCtrl = this.panelCtrl;

    function dragging(evt) {
      if (lastY === null) {
        lastY = evt.clientY;
      } else {
        var diff = evt.clientY - lastY;
        posTop = posTop + diff;
        lastY = evt.clientY;
        handleElem.css({top: posTop + diff});
      }
    }

    function stopped() {
      isMoving = false;
      // calculate graph level
      var graphValue = plot.c2p({left: 0, top: posTop}).y;
      graphValue = parseInt(graphValue.toFixed(0));
      threshold.from = graphValue;

      var valueCanvasPos = plot.p2c({x: 0, y: graphValue});

      handleElem.off("mousemove", dragging);
      handleElem.off("mouseup", dragging);

      // trigger digest and render
      panelCtrl.$scope.$apply(function() {
        panelCtrl.render();
      });
    }

    handleElem.bind('mousedown', function() {
      isMoving = true;
      lastY = null;
      posTop = handleElem.position().top;

      handleElem.on("mousemove", dragging);
      handleElem.on("mouseup", stopped);
    });
  }

  cleanUp() {
    if (this.placeholder) {
      this.placeholder.find(".alert-handle-wrapper").remove();
    }
  }

  renderHandle(type, model, defaultHandleTopPos) {
    var handleElem = this.placeholder.find(`.alert-handle-wrapper--${type}`);
    var value = model.from;
    var valueStr = value;
    var handleTopPos = 0;

    // handle no value
    if (!_.isNumber(value)) {
      valueStr = '';
      handleTopPos = defaultHandleTopPos;
    } else {
      var valueCanvasPos = this.plot.p2c({x: 0, y: value});
      handleTopPos = Math.min(Math.max(valueCanvasPos.top, 0), this.height) - 6;
    }

    if (handleElem.length === 0) {
      handleElem = $(this.getFullHandleHtml(type, model.op, valueStr));
      this.placeholder.append(handleElem);
      this.setupDragging(handleElem, model);
    } else {
      handleElem.html(this.getHandleInnerHtml(type, model.op, valueStr));
    }

    handleElem.toggleClass('alert-handle-wrapper--no-value', valueStr === '');
    handleElem.css({top: handleTopPos});
  }

  draw(plot) {
    this.plot = plot;
    this.placeholder = plot.getPlaceholder();
    this.height = plot.height();

    if (this.thresholds.length > 0) {
      this.renderHandle('crit', this.thresholds[0], 10);
    }
  }
}

