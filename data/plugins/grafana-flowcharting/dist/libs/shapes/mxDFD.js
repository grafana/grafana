"use strict";

function mxShapeDFDStart(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDStart, mxShape);
mxShapeDFDStart.prototype.cst = {
  START: 'mxgraph.dfd.start'
};

mxShapeDFDStart.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var r = Math.min(h * 0.5, w * 0.5);
  c.begin();
  c.moveTo(w - r, h * 0.5 - r);
  c.arcTo(r, r, 0, 0, 1, w, h * 0.5);
  c.arcTo(r, r, 0, 0, 1, w - r, h * 0.5 + r);
  c.lineTo(r, h * 0.5 + r);
  c.arcTo(r, r, 0, 0, 1, 0, h * 0.5);
  c.arcTo(r, r, 0, 0, 1, r, h * 0.5 - r);
  c.close();
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeDFDStart.prototype.cst.START, mxShapeDFDStart);

mxShapeDFDStart.prototype.getConstraints = function (style, w, h) {
  var constr = [];
  var r = Math.min(h * 0.5, w * 0.5);
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.5), false, null, 0, -r));
  constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.5), false, null, 0, r));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.293, h * 0.5 - r * 0.707));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.293, h * 0.5 - r * 0.707));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.293, h * 0.5 + r * 0.707));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.293, h * 0.5 + r * 0.707));

  if (w >= 4 * h) {
    constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
  }

  return constr;
};

function mxShapeDFDArchive(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDArchive, mxShape);
mxShapeDFDArchive.prototype.cst = {
  ARCHIVE: 'mxgraph.dfd.archive'
};

mxShapeDFDArchive.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  c.begin();
  c.moveTo(0, 0);
  c.lineTo(w, 0);
  c.lineTo(w * 0.5, h);
  c.close();
  c.fillAndStroke();
  c.setShadow(false);
  c.begin();
  c.moveTo(w * 0.1, h * 0.2);
  c.lineTo(w * 0.9, h * 0.2);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeDFDArchive.prototype.cst.ARCHIVE, mxShapeDFDArchive);

mxShapeDFDArchive.prototype.getConstraints = function (style, w, h) {
  var constr = [];
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.875, 0.25), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.625, 0.75), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.375, 0.75), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.125, 0.25), false));
  return constr;
};

function mxShapeDFDCheck2(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDCheck2, mxShape);
mxShapeDFDCheck2.prototype.cst = {
  CHECK2: 'mxgraph.dfd.check2'
};

mxShapeDFDCheck2.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var size = Math.min(h * 0.5, w * 0.5);
  c.begin();
  c.moveTo(0, h * 0.5);
  c.lineTo(size, 0);
  c.lineTo(w - size, 0);
  c.lineTo(w, h * 0.5);
  c.lineTo(w - size, h);
  c.lineTo(size, h);
  c.lineTo(0, h * 0.5);
  c.close();
  c.fillAndStroke();
  c.setShadow(false);
  c.begin();
  c.moveTo(w - size, 0);
  c.lineTo(w - 2 * size, h * 0.5);
  c.lineTo(w - size, h);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeDFDCheck2.prototype.cst.CHECK2, mxShapeDFDCheck2);

mxShapeDFDCheck2.prototype.getConstraints = function (style, w, h) {
  var constr = [];
  var size = Math.min(h * 0.5, w * 0.5);
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, size * 0.5, h * 0.25));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - size * 0.5, h * 0.25));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, size * 0.5, h * 0.75));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - size * 0.5, h * 0.75));

  if (w > h) {
    constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, size, 0));
    constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - size, 0));
    constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, size, h));
    constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - size, h));
  }

  if (size * 4 <= w) {
    constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
    constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
  }

  return constr;
};

function mxShapeDFDDataStoreID(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDDataStoreID, mxShape);
mxShapeDFDDataStoreID.prototype.cst = {
  DATA_STORE_ID: 'mxgraph.dfd.dataStoreID'
};

mxShapeDFDDataStoreID.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var size = Math.min(h * 0.5, w * 0.5);
  c.begin();
  c.moveTo(w, h);
  c.lineTo(0, h);
  c.lineTo(0, 0);
  c.lineTo(w, 0);
  c.stroke();
  c.setShadow(false);
  var s = Math.min(30, w);
  c.begin();
  c.moveTo(s, 0);
  c.lineTo(s, h);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeDFDDataStoreID.prototype.cst.DATA_STORE_ID, mxShapeDFDDataStoreID);
mxShapeDFDDataStoreID.prototype.constraints = null;

function mxShapeDFDExternalEntity(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDExternalEntity, mxShape);
mxShapeDFDExternalEntity.prototype.cst = {
  EXTERNAL_ENTITY: 'mxgraph.dfd.externalEntity'
};

mxShapeDFDExternalEntity.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var size = 10;
  c.begin();
  c.moveTo(0, 0);
  c.lineTo(w - size, 0);
  c.lineTo(w, size);
  c.lineTo(w, h);
  c.lineTo(size, h);
  c.lineTo(0, h - size);
  c.close();
  c.fillAndStroke();
  c.setShadow(false);
  c.setFillColor('#000000');
  c.setAlpha(0.5);
  c.begin();
  c.moveTo(0, 0);
  c.lineTo(w - size, 0);
  c.lineTo(w, size);
  c.lineTo(size, size);
  c.lineTo(size, h);
  c.lineTo(0, h - size);
  c.close();
  c.fill();
  var opacity = parseFloat(mxUtils.getValue(this.style, 'opacity', '100'));
  c.setAlpha(opacity / 100);
  c.begin();
  c.moveTo(0, 0);
  c.lineTo(w - size, 0);
  c.lineTo(w, size);
  c.lineTo(w, h);
  c.lineTo(size, h);
  c.lineTo(0, h - size);
  c.close();
  c.moveTo(size, h);
  c.lineTo(size, size);
  c.lineTo(w, size);
  c.moveTo(0, 0);
  c.lineTo(size, size);
  c.stroke();
};

mxCellRenderer.registerShape(mxShapeDFDExternalEntity.prototype.cst.EXTERNAL_ENTITY, mxShapeDFDExternalEntity);

mxShapeDFDExternalEntity.prototype.getConstraints = function (style, w, h) {
  var constr = [];
  var size = 10;
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.25, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.5, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.75, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - size, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, size, h));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.25 + size, h));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.5 + size, h));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - size) * 0.75 + size, h));
  constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, size));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, size + (h - size) * 0.25));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, size + (h - size) * 0.5));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, size + (h - size) * 0.75));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - size) * 0.25));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - size) * 0.5));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - size) * 0.75));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, h - size));
  return constr;
};

function mxShapeDFDLoop(bounds, fill, stroke, strokewidth) {
  mxShape.call(this);
  this.bounds = bounds;
  this.fill = fill;
  this.stroke = stroke;
  this.strokewidth = strokewidth != null ? strokewidth : 1;
}

;
mxUtils.extend(mxShapeDFDLoop, mxShape);
mxShapeDFDLoop.prototype.cst = {
  LOOP: 'mxgraph.dfd.loop'
};

mxShapeDFDLoop.prototype.paintVertexShape = function (c, x, y, w, h) {
  c.translate(x, y);
  var r = Math.min(h * 0.8, w * 0.8);
  c.begin();
  c.moveTo(w - r * 0.25, 0);
  c.arcTo(r, r, 0, 0, 1, w - r * 0.25, h);
  c.lineTo(r * 0.25, h);
  c.arcTo(r, r, 0, 0, 1, r * 0.25, 0);
  c.close();
  c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeDFDLoop.prototype.cst.LOOP, mxShapeDFDLoop);

mxShapeDFDLoop.prototype.getConstraints = function (style, w, h) {
  var constr = [];
  var r = Math.min(h * 0.8, w * 0.8);
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.25, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.25, h));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.25, 0));
  constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.25, h));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
  constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
  return constr;
};
