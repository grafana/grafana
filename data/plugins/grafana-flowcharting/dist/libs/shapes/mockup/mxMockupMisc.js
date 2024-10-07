"use strict";

function mxShapeMockupPlaybackControls(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupPlaybackControls, mxShape);
mxShapeMockupPlaybackControls.prototype.cst = {
  SHAPE_PLAYBACK_CONTROLS: 'mxgraph.mockup.misc.playbackControls',
  FILL_COLOR2: 'fillColor2',
  STROKE_COLOR2: 'strokeColor2',
  FILL_COLOR3: 'fillColor3',
  STROKE_COLOR3: 'strokeColor3'
};
mxShapeMockupPlaybackControls.prototype.customProperties = [{
  name: 'fillColor2',
  dispName: 'Outline Color',
  type: 'color'
}, {
  name: 'fillColor3',
  dispName: 'Symbol Color',
  type: 'color'
}, {
  name: 'strokeColor2',
  dispName: 'Outline Stroke Color',
  type: 'color'
}, {
  name: 'strokeColor3',
  dispName: 'Symbol Stroke Color',
  type: 'color'
}];

mxShapeMockupPlaybackControls.prototype.paintVertexShape = function (c, x, y, w, h) {
  var controlBarHeight = 30;
  var buttonSize = 22;
  var h = Math.max(h, controlBarHeight);
  var w = Math.max(225, w);
  c.translate(x, y);
  this.background(c, w, h, controlBarHeight);
  c.setShadow(false);
  this.foreground(c, w, h, controlBarHeight, buttonSize);
};

mxShapeMockupPlaybackControls.prototype.background = function (c, w, h, controlBarHeight) {
  c.rect(0, (h - controlBarHeight) * 0.5, w, controlBarHeight);
  c.fillAndStroke();
};

mxShapeMockupPlaybackControls.prototype.foreground = function (c, w, h, controlBarHeight, buttonSize) {
  var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupPlaybackControls.prototype.cst.FILL_COLOR2, '#99ddff');
  var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupPlaybackControls.prototype.cst.STROKE_COLOR2, 'none');
  var fillColor3 = mxUtils.getValue(this.style, mxShapeMockupPlaybackControls.prototype.cst.FILL_COLOR3, '#ffffff');
  var strokeColor3 = mxUtils.getValue(this.style, mxShapeMockupPlaybackControls.prototype.cst.STROKE_COLOR3, 'none');
  c.setStrokeColor(strokeColor2);
  c.setFillColor(fillColor2);
  c.ellipse(10, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(40, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(70, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(100, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(130, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(160, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.ellipse(190, h * 0.5 - buttonSize * 0.5, buttonSize, buttonSize);
  c.fillAndStroke();
  c.setStrokeColor(strokeColor3);
  c.setFillColor(fillColor3);
  var t = h * 0.5 - controlBarHeight * 0.5;
  c.begin();
  c.moveTo(16, t + 10);
  c.lineTo(16, t + 20);
  c.lineTo(18, t + 20);
  c.lineTo(18, t + 10);
  c.close();
  c.moveTo(20, t + 15);
  c.lineTo(25, t + 20);
  c.lineTo(25, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(44, t + 15);
  c.lineTo(49, t + 20);
  c.lineTo(49, t + 10);
  c.close();
  c.moveTo(51, t + 15);
  c.lineTo(56, t + 20);
  c.lineTo(56, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(77, t + 15);
  c.lineTo(82, t + 20);
  c.lineTo(82, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(108, t + 10);
  c.lineTo(108, t + 20);
  c.lineTo(110, t + 20);
  c.lineTo(110, t + 10);
  c.close();
  c.moveTo(117, t + 15);
  c.lineTo(112, t + 20);
  c.lineTo(112, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(144, t + 15);
  c.lineTo(139, t + 20);
  c.lineTo(139, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(171, t + 15);
  c.lineTo(166, t + 20);
  c.lineTo(166, t + 10);
  c.close();
  c.moveTo(178, t + 15);
  c.lineTo(173, t + 20);
  c.lineTo(173, t + 10);
  c.close();
  c.fillAndStroke();
  c.begin();
  c.moveTo(203, t + 10);
  c.lineTo(203, t + 20);
  c.lineTo(205, t + 20);
  c.lineTo(205, t + 10);
  c.close();
  c.moveTo(201, t + 15);
  c.lineTo(196, t + 20);
  c.lineTo(196, t + 10);
  c.close();
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupPlaybackControls.prototype.cst.SHAPE_PLAYBACK_CONTROLS, mxShapeMockupPlaybackControls);

function mxShapeMockupProgressBar(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
  this.barPos = 20;
}

;
mxUtils.extend(mxShapeMockupProgressBar, mxShape);
mxShapeMockupProgressBar.prototype.cst = {
  SHAPE_PROGRESS_BAR: 'mxgraph.mockup.misc.progressBar',
  BAR_POS: 'barPos',
  FILL_COLOR2: 'fillColor2'
};
mxShapeMockupProgressBar.prototype.customProperties = [{
  name: 'fillColor2',
  dispName: 'Outline Color',
  type: 'color'
}, {
  name: 'barPos',
  dispName: 'Handle Position',
  type: 'float',
  min: 0,
  defVal: 80
}];

mxShapeMockupProgressBar.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  this.background(c, w, h);
  c.setShadow(false);
  this.foreground(c, w, h);
};

mxShapeMockupProgressBar.prototype.background = function (c, w, h) {
  c.roundrect(0, h * 0.5 - 5, w, 10, 5, 5);
  c.fillAndStroke();
};

mxShapeMockupProgressBar.prototype.foreground = function (c, w, h) {
  var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupProgressBar.prototype.cst.FILL_COLOR2, '#ddeeff');
  var barPos = mxUtils.getValue(this.style, mxShapeMockupProgressBar.prototype.cst.BAR_POS, '80');
  barPos = Math.min(barPos, 100);
  barPos = Math.max(barPos, 0);
  var deadzone = 0;
  var virRange = w - 2 * deadzone;
  var truePos = deadzone + virRange * barPos / 100;
  c.setFillColor(fillColor2);
  c.roundrect(0, h * 0.5 - 5, truePos, 10, 5, 5);
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupProgressBar.prototype.cst.SHAPE_PROGRESS_BAR, mxShapeMockupProgressBar);

Graph.handleFactory[mxShapeMockupProgressBar.prototype.cst.SHAPE_PROGRESS_BAR] = function (state) {
  var handles = [Graph.createHandle(state, ['barPos'], function (bounds) {
    var barPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'barPos', this.barPos))));
    return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height * 0.5);
  }, function (bounds, pt) {
    this.state.style['barPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
  })];
  return handles;
};

function mxShapeMockupShoppingCart(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupShoppingCart, mxShape);
mxShapeMockupShoppingCart.prototype.cst = {
  SHAPE_SHOPPING_CART: 'mxgraph.mockup.misc.shoppingCart'
};

mxShapeMockupShoppingCart.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
  c.translate(x, y);
  c.setStrokeWidth(3);
  c.begin();
  c.moveTo(w * 0.975, h * 0.025);
  c.lineTo(w * 0.82, h * 0.055);
  c.lineTo(w * 0.59, h * 0.66);
  c.lineTo(w * 0.7, h * 0.765);
  c.arcTo(w * 0.06, h * 0.06, 0, 0, 1, w * 0.665, h * 0.86);
  c.lineTo(w * 0.05, h * 0.86);
  c.moveTo(w * 0.74, h * 0.26);
  c.lineTo(w * 0.03, h * 0.28);
  c.lineTo(w * 0.065, h * 0.61);
  c.lineTo(w * 0.59, h * 0.66);
  c.stroke();
  c.setStrokeWidth(1);
  c.begin();
  c.moveTo(w * 0.15, h * 0.28);
  c.lineTo(w * 0.15, h * 0.62);
  c.moveTo(w * 0.265, h * 0.275);
  c.lineTo(w * 0.265, h * 0.63);
  c.moveTo(w * 0.38, h * 0.27);
  c.lineTo(w * 0.38, h * 0.64);
  c.moveTo(w * 0.495, h * 0.265);
  c.lineTo(w * 0.495, h * 0.65);
  c.moveTo(w * 0.61, h * 0.265);
  c.lineTo(w * 0.61, h * 0.61);
  c.stroke();
  c.begin();
  c.moveTo(w * 0.69, h * 0.405);
  c.lineTo(w * 0.045, h * 0.405);
  c.moveTo(w * 0.645, h * 0.52);
  c.lineTo(w * 0.055, h * 0.52);
  c.stroke();
  c.setFillColor(strokeColor);
  c.ellipse(w * 0.075, h * 0.89, w * 0.1, h * 0.1);
  c.fillAndStroke();
  c.ellipse(w * 0.62, h * 0.89, w * 0.1, h * 0.1);
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupShoppingCart.prototype.cst.SHAPE_SHOPPING_CART, mxShapeMockupShoppingCart);

function mxShapeMockupRating(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupRating, mxShape);
mxShapeMockupRating.prototype.cst = {
  SHAPE_RATING: 'mxgraph.mockup.misc.rating',
  RATING_STYLE: 'ratingStyle',
  RATING_SCALE: 'ratingScale',
  RATING_HEART: 'heart',
  RATING_STAR: 'star',
  EMPTY_FILL_COLOR: 'emptyFillColor',
  GRADE: 'grade'
};
mxShapeMockupRating.prototype.customProperties = [{
  name: 'ratingStyle',
  dispName: 'Style',
  type: 'enum',
  enumList: [{
    val: 'heart',
    dispName: 'Heart'
  }, {
    val: 'star',
    dispName: 'Star'
  }]
}, {
  name: 'ratingScale',
  dispName: 'Max. Rating',
  type: 'int'
}, {
  name: 'grade',
  dispName: 'Current Rating',
  type: 'int'
}, {
  name: 'emptyFillColor',
  dispName: 'Fill2 Color',
  type: 'color'
}];

mxShapeMockupRating.prototype.paintVertexShape = function (c, x, y, w, h) {
  var ratingStyle = mxUtils.getValue(this.style, mxShapeMockupRating.prototype.cst.RATING_STYLE, mxShapeMockupRating.prototype.cst.RATING_STAR);
  var grade = mxUtils.getValue(this.style, mxShapeMockupRating.prototype.cst.GRADE, '5');
  var ratingScale = mxUtils.getValue(this.style, mxShapeMockupRating.prototype.cst.RATING_SCALE, '10');
  c.translate(x, y);

  if (ratingStyle === mxShapeMockupRating.prototype.cst.RATING_STAR) {
    for (var i = 0; i < grade; i++) {
      c.begin();
      c.moveTo(i * h * 1.5, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.364 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.475 * h, 0);
      c.lineTo(i * h * 1.5 + 0.586 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.95 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.66 * h, 0.551 * h);
      c.lineTo(i * h * 1.5 + 0.775 * h, 0.9 * h);
      c.lineTo(i * h * 1.5 + 0.475 * h, 0.684 * h);
      c.lineTo(i * h * 1.5 + 0.175 * h, 0.9 * h);
      c.lineTo(i * h * 1.5 + 0.29 * h, 0.551 * h);
      c.close();
      c.fillAndStroke();
    }
  } else if (ratingStyle === mxShapeMockupRating.prototype.cst.RATING_HEART) {
    for (var i = 0; i < grade; i++) {
      c.begin();
      c.moveTo(i * h * 1.5 + h * 0.519, h * 0.947);
      c.curveTo(i * h * 1.5 + h * 0.558, h * 0.908, i * h * 1.5 + h * 0.778, h * 0.682, i * h * 1.5 + h * 0.916, h * 0.54);
      c.curveTo(i * h * 1.5 + h * 1.039, h * 0.414, i * h * 1.5 + h * 1.036, h * 0.229, i * h * 1.5 + h * 0.924, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.812, 0, i * h * 1.5 + h * 0.631, 0, i * h * 1.5 + h * 0.519, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.408, 0, i * h * 1.5 + h * 0.227, 0, i * h * 1.5 + h * 0.115, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.03, h * 0.229, i * h * 1.5, h * 0.414, i * h * 1.5 + h * 0.123, h * 0.54);
      c.close();
      c.fillAndStroke();
    }
  }

  var emptyFillColor = mxUtils.getValue(this.style, mxShapeMockupRating.prototype.cst.EMPTY_FILL_COLOR, '#ffffff');
  c.setFillColor(emptyFillColor);

  if (ratingStyle === mxShapeMockupRating.prototype.cst.RATING_STAR) {
    for (var i = grade; i < ratingScale; i++) {
      c.begin();
      c.moveTo(i * h * 1.5, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.364 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.475 * h, 0);
      c.lineTo(i * h * 1.5 + 0.586 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.95 * h, 0.33 * h);
      c.lineTo(i * h * 1.5 + 0.66 * h, 0.551 * h);
      c.lineTo(i * h * 1.5 + 0.775 * h, 0.9 * h);
      c.lineTo(i * h * 1.5 + 0.475 * h, 0.684 * h);
      c.lineTo(i * h * 1.5 + 0.175 * h, 0.9 * h);
      c.lineTo(i * h * 1.5 + 0.29 * h, 0.551 * h);
      c.close();
      c.fillAndStroke();
    }
  } else if (ratingStyle === mxShapeMockupRating.prototype.cst.RATING_HEART) {
    for (var i = grade; i < ratingScale; i++) {
      c.begin();
      c.moveTo(i * h * 1.5 + h * 0.519, h * 0.947);
      c.curveTo(i * h * 1.5 + h * 0.558, h * 0.908, i * h * 1.5 + h * 0.778, h * 0.682, i * h * 1.5 + h * 0.916, h * 0.54);
      c.curveTo(i * h * 1.5 + h * 1.039, h * 0.414, i * h * 1.5 + h * 1.036, h * 0.229, i * h * 1.5 + h * 0.924, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.812, 0, i * h * 1.5 + h * 0.631, 0, i * h * 1.5 + h * 0.519, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.408, 0, i * h * 1.5 + h * 0.227, 0, i * h * 1.5 + h * 0.115, h * 0.115);
      c.curveTo(i * h * 1.5 + h * 0.03, h * 0.229, i * h * 1.5, h * 0.414, i * h * 1.5 + h * 0.123, h * 0.54);
      c.close();
      c.fillAndStroke();
    }
  }
};

mxCellRenderer.registerShape(mxShapeMockupRating.prototype.cst.SHAPE_RATING, mxShapeMockupRating);

function mxShapeMockupMail(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupMail, mxShape);
mxShapeMockupMail.prototype.cst = {
  SHAPE_MAIL: 'mxgraph.mockup.misc.mail2'
};

mxShapeMockupMail.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  c.rect(0, 0, w, h);
  c.fillAndStroke();
  c.setShadow(false);
  c.begin();
  c.moveTo(0, 0);
  c.lineTo(w * 0.5, h * 0.5);
  c.lineTo(w, 0);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupMail.prototype.cst.SHAPE_MAIL, mxShapeMockupMail);

function mxShapeMockupVolumeSlider(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
  this.barPos = 80;
}

;
mxUtils.extend(mxShapeMockupVolumeSlider, mxShape);
mxShapeMockupVolumeSlider.prototype.cst = {
  SHAPE_VOLUME_SLIDER: 'mxgraph.mockup.misc.volumeSlider',
  BAR_POS: 'barPos',
  FILL_COLOR2: 'fillColor2'
};
mxShapeMockupVolumeSlider.prototype.customProperties = [{
  name: 'fillColor2',
  dispName: 'Fill2 Color',
  type: 'color'
}, {
  name: 'barPos',
  dispName: 'Handle Position',
  type: 'float'
}];

mxShapeMockupVolumeSlider.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var barPos = mxUtils.getValue(this.style, mxShapeMockupVolumeSlider.prototype.cst.BAR_POS, '80');
  var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupVolumeSlider.prototype.cst.FILL_COLOR2, '#ddeeff');
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  barPos = Math.min(barPos, 100);
  barPos = Math.max(barPos, 0);
  var controlBarHeight = 25;
  var h = Math.max(h, controlBarHeight);
  var w = Math.max(w, 3.5 * controlBarHeight);
  var speakerStartX = w - controlBarHeight;
  var speakerStartY = (h - controlBarHeight) * 0.5;
  c.begin();
  c.moveTo(speakerStartX + controlBarHeight * 0.05, speakerStartY + controlBarHeight * 0.35);
  c.lineTo(speakerStartX + controlBarHeight * 0.15, speakerStartY + controlBarHeight * 0.35);
  c.lineTo(speakerStartX + controlBarHeight * 0.3, speakerStartY + controlBarHeight * 0.2);
  c.lineTo(speakerStartX + controlBarHeight * 0.3, speakerStartY + controlBarHeight * 0.8);
  c.lineTo(speakerStartX + controlBarHeight * 0.15, speakerStartY + controlBarHeight * 0.65);
  c.lineTo(speakerStartX + controlBarHeight * 0.05, speakerStartY + controlBarHeight * 0.65);
  c.close();
  c.fill();
  var barMin = 0;
  var barMax = w - controlBarHeight * 1.3;
  var videoBarStartY = (h - controlBarHeight) * 0.5;
  var barRange = barMax - barMin;
  var barPos = barRange * barPos / 100;
  var barEnd = barMin + barPos;
  var soundStartX = w - controlBarHeight;
  var soundStartY = (h - controlBarHeight) * 0.5;
  c.begin();
  c.moveTo(soundStartX + controlBarHeight * 0.4, soundStartY + controlBarHeight * 0.35);
  c.arcTo(controlBarHeight * 0.2, controlBarHeight * 0.3, 0, 0, 1, soundStartX + controlBarHeight * 0.4, soundStartY + controlBarHeight * 0.65);
  c.moveTo(soundStartX + controlBarHeight * 0.425, soundStartY + controlBarHeight * 0.25);
  c.arcTo(controlBarHeight * 0.225, controlBarHeight * 0.35, 0, 0, 1, soundStartX + controlBarHeight * 0.425, soundStartY + controlBarHeight * 0.75);
  c.moveTo(soundStartX + controlBarHeight * 0.5, soundStartY + controlBarHeight * 0.2);
  c.arcTo(controlBarHeight * 0.25, controlBarHeight * 0.4, 0, 0, 1, soundStartX + controlBarHeight * 0.5, soundStartY + controlBarHeight * 0.8);
  c.fillAndStroke();
  var videoBarStartX = 0;
  var videoBarStartY = (h - controlBarHeight) * 0.5;
  var videoBarEndX = w - controlBarHeight * 1.3;
  c.roundrect(videoBarStartX, videoBarStartY + controlBarHeight * 0.35, videoBarEndX, controlBarHeight * 0.3, 5, 5);
  c.fill();
  c.setShadow(false);
  c.setFillColor(fillColor2);
  c.roundrect(barMin, videoBarStartY + controlBarHeight * 0.35, barEnd, controlBarHeight * 0.3, 5, 5);
  c.fill();
  c.ellipse(barEnd - controlBarHeight * 0.25, videoBarStartY + controlBarHeight * 0.25, controlBarHeight * 0.5, controlBarHeight * 0.5);
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupVolumeSlider.prototype.cst.SHAPE_VOLUME_SLIDER, mxShapeMockupVolumeSlider);

Graph.handleFactory[mxShapeMockupVolumeSlider.prototype.cst.SHAPE_VOLUME_SLIDER] = function (state) {
  var handles = [Graph.createHandle(state, ['barPos'], function (bounds) {
    var barPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'barPos', this.barPos))));
    return new mxPoint(bounds.x + barPos * (bounds.width - 32.5) / 100, bounds.y + bounds.height * 0.5);
  }, function (bounds, pt) {
    this.state.style['barPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
  })];
  return handles;
};

function mxShapeMockupEdit(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupEdit, mxShape);
mxShapeMockupEdit.prototype.cst = {
  SHAPE_EDIT: 'mxgraph.mockup.misc.editIcon'
};

mxShapeMockupEdit.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.11, h * 0.8);
  c.lineTo(w * 0.2, h * 0.89);
  c.lineTo(w * 0.05, h * 0.95);
  c.close();
  c.moveTo(w * 0.74, h * 0.16);
  c.lineTo(w * 0.84, h * 0.26);
  c.lineTo(w * 0.22, h * 0.88);
  c.lineTo(w * 0.12, h * 0.78);
  c.close();
  c.moveTo(w * 0.755, h * 0.145);
  c.lineTo(w * 0.82, h * 0.08);
  c.lineTo(w * 0.92, h * 0.18);
  c.lineTo(w * 0.855, h * 0.245);
  c.close();
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupEdit.prototype.cst.SHAPE_EDIT, mxShapeMockupEdit);

function mxShapeMockupPrint(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupPrint, mxShape);
mxShapeMockupPrint.prototype.cst = {
  SHAPE_PRINT: 'mxgraph.mockup.misc.printIcon'
};

mxShapeMockupPrint.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.15, h * 0.58);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.18, h * 0.55);
  c.lineTo(w * 0.82, h * 0.55);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.85, h * 0.58);
  c.lineTo(w * 0.85, h * 0.82);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.82, h * 0.85);
  c.lineTo(w * 0.18, h * 0.85);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.15, h * 0.82);
  c.close();
  c.moveTo(w * 0.7, h * 0.52);
  c.lineTo(w * 0.3, h * 0.52);
  c.lineTo(w * 0.3, h * 0.15);
  c.lineTo(w * 0.55, h * 0.15);
  c.lineTo(w * 0.55, h * 0.3);
  c.lineTo(w * 0.7, h * 0.3);
  c.close();
  c.moveTo(w * 0.57, h * 0.15);
  c.lineTo(w * 0.7, h * 0.28);
  c.lineTo(w * 0.57, h * 0.28);
  c.close();
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupPrint.prototype.cst.SHAPE_PRINT, mxShapeMockupPrint);

function mxShapeMockupShare(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupShare, mxShape);
mxShapeMockupShare.prototype.cst = {
  SHAPE_SHARE: 'mxgraph.mockup.misc.shareIcon'
};

mxShapeMockupShare.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.15, h * 0.18);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.18, h * 0.15);
  c.lineTo(w * 0.82, h * 0.15);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.85, h * 0.18);
  c.lineTo(w * 0.85, h * 0.82);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.82, h * 0.85);
  c.lineTo(w * 0.18, h * 0.85);
  c.arcTo(w * 0.03, h * 0.03, 0, 0, 1, w * 0.15, h * 0.82);
  c.close();
  c.fill();
  var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
  c.setFillColor(fillColor);
  c.begin();
  c.moveTo(w * 0.563, h * 0.34);
  c.arcTo(w * 0.095, h * 0.095, 0, 1, 1, w * 0.603, h * 0.42);
  c.lineTo(w * 0.44, h * 0.5);
  c.lineTo(w * 0.602, h * 0.582);
  c.arcTo(w * 0.095, h * 0.095, 0, 1, 1, w * 0.563, h * 0.653);
  c.lineTo(w * 0.403, h * 0.575);
  c.arcTo(w * 0.095, h * 0.095, 0, 1, 1, w * 0.4, h * 0.42);
  c.close();
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupShare.prototype.cst.SHAPE_SHARE, mxShapeMockupShare);

function mxShapeMockupTrashcan(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupTrashcan, mxShape);
mxShapeMockupTrashcan.prototype.cst = {
  SHAPE_TRASHCAN: 'mxgraph.mockup.misc.trashcanIcon'
};

mxShapeMockupTrashcan.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.24, h * 0.24);
  c.arcTo(w * 0.04, h * 0.04, 0, 0, 1, w * 0.24, h * 0.16);
  c.lineTo(w * 0.4, h * 0.16);
  c.lineTo(w * 0.4, h * 0.12);
  c.lineTo(w * 0.6, h * 0.12);
  c.lineTo(w * 0.6, h * 0.16);
  c.lineTo(w * 0.76, h * 0.16);
  c.arcTo(w * 0.04, h * 0.04, 0, 0, 1, w * 0.76, h * 0.24);
  c.close();
  c.fill();
  c.roundrect(w * 0.26, h * 0.3, w * 0.1, h * 0.6, w * 0.06, h * 0.06);
  c.fill();
  c.roundrect(w * 0.44, h * 0.3, w * 0.1, h * 0.6, w * 0.06, h * 0.06);
  c.fill();
  c.roundrect(w * 0.62, h * 0.3, w * 0.1, h * 0.6, w * 0.06, h * 0.06);
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupTrashcan.prototype.cst.SHAPE_TRASHCAN, mxShapeMockupTrashcan);

function mxShapeMockupCopyright(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupCopyright, mxShape);
mxShapeMockupCopyright.prototype.cst = {
  SHAPE_COPYRIGHT: 'mxgraph.mockup.misc.copyrightIcon'
};

mxShapeMockupCopyright.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.ellipse(0, 0, w, h);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.713, h * 0.288);
  c.arcTo(w * 0.3, h * 0.3, 0, 1, 0, w * 0.713, h * 0.712);
  c.lineTo(w * 0.784, h * 0.783);
  c.arcTo(w * 0.4, h * 0.4, 0, 1, 1, w * 0.784, h * 0.217);
  c.close();
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupCopyright.prototype.cst.SHAPE_COPYRIGHT, mxShapeMockupCopyright);

function mxShapeMockupRegistered(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupRegistered, mxShape);
mxShapeMockupRegistered.prototype.cst = {
  SHAPE_REGISTERED: 'mxgraph.mockup.misc.registeredIcon'
};

mxShapeMockupRegistered.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.ellipse(0, 0, w, h);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.29, h * 0.9);
  c.lineTo(w * 0.29, h * 0.09);
  c.lineTo(w * 0.5, h * 0.09);
  c.arcTo(w * 0.2195, h * 0.2195, 0, 0, 1, w * 0.545, h * 0.525);
  c.lineTo(w * 0.738, h * 0.91);
  c.lineTo(w * 0.674, h * 0.91);
  c.lineTo(w * 0.4825, h * 0.53);
  c.lineTo(w * 0.35, h * 0.53);
  c.lineTo(w * 0.35, h * 0.9);
  c.close();
  c.moveTo(w * 0.35, h * 0.47);
  c.lineTo(w * 0.5, h * 0.47);
  c.arcTo(w * 0.15, h * 0.15, 0, 0, 0, w * 0.5, h * 0.15);
  c.lineTo(w * 0.35, h * 0.15);
  c.close();
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupRegistered.prototype.cst.SHAPE_REGISTERED, mxShapeMockupRegistered);

function mxShapeMockupVolume(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupVolume, mxShape);
mxShapeMockupVolume.prototype.cst = {
  SHAPE_VOLUME: 'mxgraph.mockup.misc.volumeIcon'
};

mxShapeMockupVolume.prototype.paintVertexShape = function (c, x, y, w, h) {
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
  c.translate(x, y);
  c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor(strokeColor);
  c.begin();
  c.moveTo(w * 0.1, h * 0.3);
  c.lineTo(w * 0.3, h * 0.3);
  c.lineTo(w * 0.5, h * 0.15);
  c.lineTo(w * 0.5, h * 0.85);
  c.lineTo(w * 0.3, h * 0.7);
  c.lineTo(w * 0.1, h * 0.7);
  c.close();
  c.fill();
  c.begin();
  c.moveTo(w * 0.6, h * 0.4);
  c.arcTo(w * 0.2, h * 0.2, 0, 0, 1, w * 0.6, h * 0.6);
  c.moveTo(w * 0.7, h * 0.3);
  c.arcTo(w * 0.3, h * 0.3, 0, 0, 1, w * 0.7, h * 0.7);
  c.moveTo(w * 0.8, h * 0.2);
  c.arcTo(w * 0.4, h * 0.4, 0, 0, 1, w * 0.8, h * 0.8);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupVolume.prototype.cst.SHAPE_VOLUME, mxShapeMockupVolume);

function mxShapeMockupRuler(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupRuler, mxShape);
mxShapeMockupRuler.prototype.cst = {
  SHAPE_RULER: 'mxgraph.mockup.misc.ruler',
  ORIENTATION: 'rulerOrient',
  UNIT_SIZE: 'unitSize',
  FACE_UP: 'up',
  FACE_DOWN: 'down'
};

mxShapeMockupRuler.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  this.background(c, w, h);
  c.setShadow(false);
  this.foreground(c, w, h);
};

mxShapeMockupRuler.prototype.background = function (c, w, h) {
  c.rect(0, 0, w, h);
  c.fillAndStroke();
};

mxShapeMockupRuler.prototype.foreground = function (c, w, h) {
  var facing = mxUtils.getValue(this.style, mxShapeMockupRuler.prototype.cst.ORIENTATION, mxShapeMockupRuler.prototype.cst.FACE_DOWN);
  var unitSize = mxUtils.getValue(this.style, mxShapeMockupRuler.prototype.cst.UNIT_SIZE, '10');
  unitSize = Math.max(unitSize, 1);
  var currX = unitSize;
  var i = 1;

  if (facing === mxShapeMockupRuler.prototype.cst.FACE_DOWN) {
    c.begin();

    while (currX < w) {
      var remainder = i % 10;

      if (remainder === 0) {
        c.moveTo(currX, h * 0.5);
        c.lineTo(currX, h);
      } else if (remainder === 5) {
        c.moveTo(currX, h * 0.7);
        c.lineTo(currX, h);
      } else {
        c.moveTo(currX, h * 0.8);
        c.lineTo(currX, h);
      }

      currX = currX + unitSize;
      i = i + 1;
    }

    c.stroke();
  } else if (facing === mxShapeMockupRuler.prototype.cst.FACE_UP) {
    c.begin();

    while (currX < w) {
      var remainder = i % 10;

      if (remainder === 0) {
        c.moveTo(currX, h * 0.5);
        c.lineTo(currX, 0);
      } else if (remainder === 5) {
        c.moveTo(currX, h * 0.3);
        c.lineTo(currX, 0);
      } else {
        c.moveTo(currX, h * 0.2);
        c.lineTo(currX, 0);
      }

      currX = currX + unitSize;
      i = i + 1;
    }

    c.stroke();
  }
};

mxCellRenderer.registerShape(mxShapeMockupRuler.prototype.cst.SHAPE_RULER, mxShapeMockupRuler);

function mxShapeMockupRuler2(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupRuler2, mxShape);
mxShapeMockupRuler2.prototype.cst = {
  SHAPE_RULER: 'mxgraph.mockup.misc.ruler2',
  ORIENTATION: 'rulerOrient',
  UNIT_SIZE: 'dx',
  FACE_UP: 'up',
  FACE_DOWN: 'down'
};
mxShapeMockupRuler2.prototype.customProperties = [{
  name: 'rulerOrient',
  dispName: 'Orientation',
  defVal: 'up',
  type: 'enum',
  enumList: [{
    val: 'up',
    dispName: 'Up'
  }, {
    val: 'down',
    dispName: 'Down'
  }]
}, {
  name: 'dx',
  dispName: 'Unit Size',
  type: 'float',
  min: 0,
  defVal: 100
}];

mxShapeMockupRuler2.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  this.background(c, w, h);
  c.setShadow(false);
  this.foreground(c, x, y, w, h);
};

mxShapeMockupRuler2.prototype.background = function (c, w, h) {
  c.rect(0, 0, w, h);
  c.fillAndStroke();
};

mxShapeMockupRuler2.prototype.foreground = function (c, x, y, w, h) {
  var facing = mxUtils.getValue(this.style, mxShapeMockupRuler2.prototype.cst.ORIENTATION, mxShapeMockupRuler2.prototype.cst.FACE_DOWN);
  var fontColor = mxUtils.getValue(this.style, mxConstants.STYLE_FONTCOLOR, '#000000');
  var dx = mxUtils.getValue(this.style, 'dx', '100');
  var unitSize = dx / 10;
  this.state.style['spacingLeft'] = Math.round(1000 * Math.max(0, Math.min(w, dx))) / 1000 - 4;
  unitSize = Math.max(unitSize, 1);
  c.setFontColor(fontColor);
  var currX = unitSize;
  var i = 1;

  if (facing === mxShapeMockupRuler2.prototype.cst.FACE_DOWN) {
    c.begin();

    while (currX < w) {
      var remainder = i % 10;

      if (remainder === 0) {
        c.moveTo(currX, h - 10);
        c.lineTo(currX, h);
        var unit = this.state.view.graph.getLabel(this.state.cell);

        if (!isNaN(unit)) {
          c.stroke();
          var num = i * Math.round(100 * unit) / 1000;

          if (i != 10 && num != 0) {
            c.text(currX, (h - 10) * 0.5, 0, 0, num.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
          }

          c.begin();
        }
      } else if (remainder === 5) {
        c.moveTo(currX, h - 6);
        c.lineTo(currX, h);
      } else {
        c.moveTo(currX, h - 4);
        c.lineTo(currX, h);
      }

      currX = currX + unitSize;
      i = i + 1;
    }

    c.stroke();
  } else if (facing === mxShapeMockupRuler2.prototype.cst.FACE_UP) {
    c.begin();

    while (currX < w) {
      var remainder = i % 10;

      if (remainder === 0) {
        c.moveTo(currX, 10);
        c.lineTo(currX, 0);
        var unit = this.state.view.graph.getLabel(this.state.cell);

        if (!isNaN(unit)) {
          c.stroke();
          var num = i * Math.round(100 * unit) / 1000;

          if (i != 10 && num != 0) {
            c.text(currX, (h + 10) * 0.5, 0, 0, num.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
          }

          c.begin();
        }
      } else if (remainder === 5) {
        c.moveTo(currX, 6);
        c.lineTo(currX, 0);
      } else {
        c.moveTo(currX, 4);
        c.lineTo(currX, 0);
      }

      currX = currX + unitSize;
      i = i + 1;
    }

    c.stroke();
  }
};

mxCellRenderer.registerShape(mxShapeMockupRuler2.prototype.cst.SHAPE_RULER, mxShapeMockupRuler2);

Graph.handleFactory[mxShapeMockupRuler2.prototype.cst.SHAPE_RULER] = function (state) {
  var handles = [Graph.createHandle(state, ['dx', 'spacingLeft', 'align', 'varticalAlign', 'spacingBottom', 'spacingTop', 'spacingRight', 'spacing'], function (bounds) {
    var dx = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'dx', this.dx))));
    return new mxPoint(bounds.x + dx, bounds.y + bounds.height - 10);
  }, function (bounds, pt) {
    this.state.style['dx'] = Math.round(1000 * Math.max(0, Math.min(bounds.width, pt.x - bounds.x))) / 1000;
    this.state.style['spacingLeft'] = Math.round(1000 * Math.max(0, Math.min(bounds.width, pt.x - bounds.x))) / 1000 - 4;
    this.state.style['align'] = 'left';
    this.state.style['verticalAlign'] = 'middle';
    var facing = mxUtils.getValue(this.state.style, 'rulerOrient', '1');

    if (facing == 'down') {
      this.state.style['spacingBottom'] = 10;
      this.state.style['spacingTop'] = 0;
    } else {
      this.state.style['spacingBottom'] = 0;
      this.state.style['spacingTop'] = 10;
    }

    this.state.style['spacingRight'] = 0;
    this.state.style['spacing'] = 0;
  })];
  return handles;
};

function mxShapeMockupRevisionTable(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupRevisionTable, mxShape);
mxShapeMockupRevisionTable.prototype.cst = {
  SHAPE_REVISION_TABLE: 'mxgraph.mockup.misc.revisionTable',
  MAIN_TEXT: 'mainText',
  TEXT_COLOR: 'textColor',
  TEXT_SIZE: 'textSize'
};

mxShapeMockupRevisionTable.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  this.background(c, w, h);
  c.setShadow(false);
  this.foreground(c, w, h);
};

mxShapeMockupRevisionTable.prototype.background = function (c, w, h) {
  c.rect(0, 0, w, h);
  c.fillAndStroke();
};

mxShapeMockupRevisionTable.prototype.foreground = function (c, w, h) {
  var mainText = mxUtils.getValue(this.style, mxShapeMockupRevisionTable.prototype.cst.MAIN_TEXT, '').toString().split(',');
  var textColor = mxUtils.getValue(this.style, mxShapeMockupRevisionTable.prototype.cst.TEXT_COLOR, '#999999');
  var textSize = mxUtils.getValue(this.style, mxShapeMockupRevisionTable.prototype.cst.TEXT_SIZE, '17');
  c.begin();
  c.moveTo(0, h * 0.33);
  c.lineTo(w, h * 0.33);
  c.moveTo(0, h * 0.67);
  c.lineTo(w, h * 0.67);
  c.moveTo(w * 0.125, h * 0.33);
  c.lineTo(w * 0.125, h);
  c.moveTo(w * 0.5, h * 0.33);
  c.lineTo(w * 0.5, h);
  c.stroke();
  c.setFontSize(textSize);
  c.setFontColor(textColor);
  c.text(w * 0.5, h * 0.165, 0, 0, mainText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.0625, h * 0.5, 0, 0, mainText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.3125, h * 0.5, 0, 0, mainText[2], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.75, h * 0.5, 0, 0, mainText[3], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.0625, h * 0.835, 0, 0, mainText[4], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.3125, h * 0.835, 0, 0, mainText[5], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(w * 0.75, h * 0.835, 0, 0, mainText[6], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupRevisionTable.prototype.cst.SHAPE_REVISION_TABLE, mxShapeMockupRevisionTable);

function mxShapeMockupStatusBar(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupStatusBar, mxShape);
mxShapeMockupStatusBar.prototype.cst = {
  SHAPE_STATUS_BAR: 'mxgraph.mockup.misc.statusBar',
  MAIN_TEXT: 'mainText',
  FILL_COLOR2: 'fillColor2',
  STROKE_COLOR2: 'strokeColor2',
  TEXT_COLOR: 'textColor',
  TEXT_SIZE: 'textSize'
};

mxShapeMockupStatusBar.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  w = Math.max(w, 105);
  this.background(c, w, h);
  c.setShadow(false);
  this.foreground(c, w, h);
};

mxShapeMockupStatusBar.prototype.background = function (c, w, h) {
  c.rect(0, h * 0.5 - 15, w, 30);
  c.fillAndStroke();
};

mxShapeMockupStatusBar.prototype.foreground = function (c, w, h) {
  var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupStatusBar.prototype.cst.FILL_COLOR2, '#ddeeff');
  var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupStatusBar.prototype.cst.STROKE_COLOR2, '#008cff');
  var mainText = mxUtils.getValue(this.style, mxShapeMockupStatusBar.prototype.cst.MAIN_TEXT, '').toString().split(',');
  var textColor = mxUtils.getValue(this.style, mxShapeMockupStatusBar.prototype.cst.TEXT_COLOR, '#999999');
  var textSize = mxUtils.getValue(this.style, mxShapeMockupStatusBar.prototype.cst.TEXT_SIZE, '17');
  c.setFillColor(fillColor2);
  c.roundrect(5, h * 0.5 - 10, (w - 75) * 0.46, 20, 5, 5);
  c.fill();
  c.roundrect(10 + (w - 75) * 0.46, h * 0.5 - 10, (w - 75) * 0.23, 20, 5, 5);
  c.fill();
  c.roundrect(15 + (w - 75) * 0.69, h * 0.5 - 10, (w - 75) * 0.276, 20, 5, 5);
  c.fill();
  c.setFontSize(textSize);
  c.setFontColor(textColor);
  c.text(10, h * 0.5, 0, 0, mainText[0], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(10 + (w - 75) * 0.575, h * 0.5, 0, 0, mainText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.text(15 + (w - 75) * 0.828, h * 0.5, 0, 0, mainText[2], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
  c.setStrokeColor(strokeColor2);
  c.ellipse(w - 25, h * 0.5 - 10, 20, 20);
  c.stroke();
  c.begin();
  c.moveTo(w - 55, h * 0.5 + 10);
  c.lineTo(w - 35, h * 0.5 + 10);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupStatusBar.prototype.cst.SHAPE_STATUS_BAR, mxShapeMockupStatusBar);

function mxShapeMockupPin(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupPin, mxShape);
mxShapeMockupPin.prototype.cst = {
  SHAPE_PIN: 'mxgraph.mockup.misc.pin',
  FILL_COLOR2: 'fillColor2',
  FILL_COLOR3: 'fillColor3'
};
mxShapeMockupPin.prototype.customProperties = [{
  name: 'fillColor2',
  dispName: 'Fill2 Color',
  type: 'color'
}, {
  name: 'fillColor3',
  dispName: 'Fill3 Color',
  type: 'color'
}];

mxShapeMockupPin.prototype.paintVertexShape = function (c, x, y, w, h) {
  var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupPin.prototype.cst.FILL_COLOR2, '#000000');
  var fillColor3 = mxUtils.getValue(this.style, mxShapeMockupPin.prototype.cst.FILL_COLOR3, '#000000');
  var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
  c.setShadow(false);
  c.translate(x, y);
  c.setStrokeWidth(3);
  c.setStrokeColor('#666666');
  c.begin();
  c.moveTo(w * 0.5, h * 0.4);
  c.lineTo(w * 0.5, h);
  c.stroke();
  c.setStrokeWidth(2);
  c.setStrokeColor(strokeColor);
  c.setGradient(fillColor2, fillColor3, 0, 0, w, h * 0.4, mxConstants.DIRECTION_SOUTH, 1, 1);
  c.setAlpha(0.9);
  c.ellipse(0, 0, w, h * 0.4);
  c.fillAndStroke();
  c.setFillColor('#ffffff');
  c.setAlpha(0.5);
  c.ellipse(w * 0.2, h * 0.08, w * 0.3, h * 0.12);
  c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupPin.prototype.cst.SHAPE_PIN, mxShapeMockupPin);

function mxShapeMockupMiscRRect(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeMockupMiscRRect, mxShape);
mxShapeMockupMiscRRect.prototype.cst = {
  RRECT: 'mxgraph.mockup.misc.rrect',
  R_SIZE: 'rSize'
};
mxShapeMockupMiscRRect.prototype.customProperties = [{
  name: 'rSize',
  dispName: 'Arc Size',
  type: 'float',
  min: 0,
  defVal: 10
}];

mxShapeMockupMiscRRect.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupMiscRRect.prototype.cst.R_SIZE, '10'));
  c.roundrect(0, 0, w, h, rSize);
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupMiscRRect.prototype.cst.RRECT, mxShapeMockupMiscRRect);

function mxShapeMockupMiscAnchor(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
}

;
mxUtils.extend(mxShapeMockupMiscAnchor, mxShape);
mxShapeMockupMiscAnchor.prototype.cst = {
  ANCHOR: 'mxgraph.mockup.misc.anchor'
};

mxShapeMockupMiscAnchor.prototype.paintVertexShape = function (c, x, y, w, h) {};

mxCellRenderer.registerShape(mxShapeMockupMiscAnchor.prototype.cst.ANCHOR, mxShapeMockupMiscAnchor);
