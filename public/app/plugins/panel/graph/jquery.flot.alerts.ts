///<reference path="../../../headers/common.d.ts" />

import 'jquery.flot';
import $ from 'jquery';
import _ from 'lodash';

var options = {};

function getHandleTemplate(type, op, value) {
  if (op === '>') { op = '&gt;'; }
  if (op === '<') { op = '&lt;'; }

  return  `
  <div class="alert-handle-wrapper alert-handle-wrapper--${type}">
    <div class="alert-handle-line">
    </div>
    <div class="alert-handle">
      <i class="icon-gf icon-gf-${type} alert-icon-${type}"></i>
      ${op} ${value}
    </div>
  </div>
  `;
}


function drawAlertHandles(plot) {
  var options = plot.getOptions();
  var $placeholder = plot.getPlaceholder();

  if (!options.alerting.editing) {
    $placeholder.find(".alert-handle").remove();
    return;
  }

  var alert = options.alerting.alert;
  var height = plot.height();

  function renderHandle(type, model) {
    var $handle = $placeholder.find(`.alert-handle-${type}`);

    if (!_.isNumber(model.level)) {
      $handle.remove();
      return;
    }

    if ($handle.length === 0) {
      $handle = $(getHandleTemplate(type, model.op, model.level));
      $placeholder.append($handle);
    } else {
      $handle.html(getHandleTemplate(type, model.op, model.level));
    }

    var levelCanvasPos = plot.p2c({x: 0, y: model.level});
    console.log('canvas level pos', levelCanvasPos.top);

    var levelTopPos = Math.min(Math.max(levelCanvasPos.top, 0), height) - 6;
    $handle.css({top: levelTopPos});
  }

  renderHandle('critical', alert.critical);
  renderHandle('warn', alert.warn);
}

function shutdown() {
}

function init(plot, classes) {
  plot.hooks.draw.push(drawAlertHandles);
  plot.hooks.shutdown.push(shutdown);
}

$.plot.plugins.push({
  init: init,
  options: options,
  name: 'navigationControl',
  version: '1.4'
});

