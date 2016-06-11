///<reference path="../../../headers/common.d.ts" />

import 'jquery.flot';
import $ from 'jquery';

var options = {};

function getHandleTemplate(type) {
  return  `
  <div class="alert-handle" style="position: absolute; top: 100px; right: -50px;">
    <i class="icon-gf icon-gf-${type} alert-icon-${type}"></i>
    > 100
  </div>
  `;
}

function drawAlertHandles(plot, canvascontext) {
  var $warnHandle = $(getHandleTemplate('warn'));

  var $placeholder = plot.getPlaceholder();
  $placeholder.find(".alert-warn-handle").remove();
  $placeholder.append($warnHandle);
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

