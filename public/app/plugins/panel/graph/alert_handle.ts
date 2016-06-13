///<reference path="../../../headers/common.d.ts" />

import 'jquery.flot';
import $ from 'jquery';
import _ from 'lodash';

export class AlertHandleManager {
  plot: any;
  placeholder: any;
  height: any;
  alert: any;

  constructor(private panelCtrl) {
    this.alert = panelCtrl.panel.alert;
  }

  getHandleInnerHtml(type, op, value) {
    if (op === '>') { op = '&gt;'; }
    if (op === '<') { op = '&lt;'; }

    return `
    <div class="alert-handle-line">
    </div>
    <div class="alert-handle">
    <i class="icon-gf icon-gf-${type} alert-icon-${type}"></i>
    ${op} ${value}
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

  setupDragging(handleElem, levelModel) {
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
      var graphLevel = plot.c2p({left: 0, top: posTop}).y;
      console.log('canvasPos:' + posTop + ' Graph level: ' + graphLevel);
      graphLevel = parseInt(graphLevel.toFixed(0));
      levelModel.level = graphLevel;
      console.log(levelModel);

      var levelCanvasPos = plot.p2c({x: 0, y: graphLevel});
      console.log('canvas pos', levelCanvasPos);

      console.log('stopped');
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
      console.log('start pos', posTop);

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
    var level = model.level;
    var levelStr = level;
    var handleTopPos = 0;

    // handle no value
    if (!_.isNumber(level)) {
      levelStr = '';
      handleTopPos = defaultHandleTopPos;
    } else {
      var levelCanvasPos = this.plot.p2c({x: 0, y: level});
      handleTopPos = Math.min(Math.max(levelCanvasPos.top, 0), this.height) - 6;
    }

    if (handleElem.length === 0) {
      console.log('creating handle');
      handleElem = $(this.getFullHandleHtml(type, model.op, levelStr));
      this.placeholder.append(handleElem);
      this.setupDragging(handleElem, model);
    } else {
      console.log('reusing handle!');
      handleElem.html(this.getHandleInnerHtml(type, model.op, levelStr));
    }

    handleElem.toggleClass('alert-handle-wrapper--no-value', levelStr === '');
    handleElem.css({top: handleTopPos});
  }

  draw(plot) {
    this.plot = plot;
    this.placeholder = plot.getPlaceholder();
    this.height = plot.height();

    this.renderHandle('critical', this.alert.critical, 10);
    this.renderHandle('warn', this.alert.warn, this.height-30);
  }

}

