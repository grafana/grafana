/* */ 
'use strict';
var curve = require('./index');
var elliptic = require('../../elliptic');
var bn = require('bn.js');
var inherits = require('inherits');
var Base = curve.base;
var assert = elliptic.utils.assert;
function EdwardsCurve(conf) {
  this.twisted = (conf.a | 0) !== 1;
  this.mOneA = this.twisted && (conf.a | 0) === -1;
  this.extended = this.mOneA;
  Base.call(this, 'edwards', conf);
  this.a = new bn(conf.a, 16).umod(this.red.m);
  this.a = this.a.toRed(this.red);
  this.c = new bn(conf.c, 16).toRed(this.red);
  this.c2 = this.c.redSqr();
  this.d = new bn(conf.d, 16).toRed(this.red);
  this.dd = this.d.redAdd(this.d);
  assert(!this.twisted || this.c.fromRed().cmpn(1) === 0);
  this.oneC = (conf.c | 0) === 1;
}
inherits(EdwardsCurve, Base);
module.exports = EdwardsCurve;
EdwardsCurve.prototype._mulA = function _mulA(num) {
  if (this.mOneA)
    return num.redNeg();
  else
    return this.a.redMul(num);
};
EdwardsCurve.prototype._mulC = function _mulC(num) {
  if (this.oneC)
    return num;
  else
    return this.c.redMul(num);
};
EdwardsCurve.prototype.jpoint = function jpoint(x, y, z, t) {
  return this.point(x, y, z, t);
};
EdwardsCurve.prototype.pointFromX = function pointFromX(x, odd) {
  x = new bn(x, 16);
  if (!x.red)
    x = x.toRed(this.red);
  var x2 = x.redSqr();
  var rhs = this.c2.redSub(this.a.redMul(x2));
  var lhs = this.one.redSub(this.c2.redMul(this.d).redMul(x2));
  var y = rhs.redMul(lhs.redInvm()).redSqrt();
  var isOdd = y.fromRed().isOdd();
  if (odd && !isOdd || !odd && isOdd)
    y = y.redNeg();
  return this.point(x, y);
};
EdwardsCurve.prototype.pointFromY = function pointFromY(y, odd) {
  y = new bn(y, 16);
  if (!y.red)
    y = y.toRed(this.red);
  var y2 = y.redSqr();
  var lhs = y2.redSub(this.one);
  var rhs = y2.redMul(this.d).redAdd(this.one);
  var x2 = lhs.redMul(rhs.redInvm());
  if (x2.cmp(this.zero) === 0) {
    if (odd)
      throw new Error('invalid point');
    else
      return this.point(this.zero, y);
  }
  var x = x2.redSqrt();
  if (x.redSqr().redSub(x2).cmp(this.zero) !== 0)
    throw new Error('invalid point');
  if (x.isOdd() !== odd)
    x = x.redNeg();
  return this.point(x, y);
};
EdwardsCurve.prototype.validate = function validate(point) {
  if (point.isInfinity())
    return true;
  point.normalize();
  var x2 = point.x.redSqr();
  var y2 = point.y.redSqr();
  var lhs = x2.redMul(this.a).redAdd(y2);
  var rhs = this.c2.redMul(this.one.redAdd(this.d.redMul(x2).redMul(y2)));
  return lhs.cmp(rhs) === 0;
};
function Point(curve, x, y, z, t) {
  Base.BasePoint.call(this, curve, 'projective');
  if (x === null && y === null && z === null) {
    this.x = this.curve.zero;
    this.y = this.curve.one;
    this.z = this.curve.one;
    this.t = this.curve.zero;
    this.zOne = true;
  } else {
    this.x = new bn(x, 16);
    this.y = new bn(y, 16);
    this.z = z ? new bn(z, 16) : this.curve.one;
    this.t = t && new bn(t, 16);
    if (!this.x.red)
      this.x = this.x.toRed(this.curve.red);
    if (!this.y.red)
      this.y = this.y.toRed(this.curve.red);
    if (!this.z.red)
      this.z = this.z.toRed(this.curve.red);
    if (this.t && !this.t.red)
      this.t = this.t.toRed(this.curve.red);
    this.zOne = this.z === this.curve.one;
    if (this.curve.extended && !this.t) {
      this.t = this.x.redMul(this.y);
      if (!this.zOne)
        this.t = this.t.redMul(this.z.redInvm());
    }
  }
}
inherits(Point, Base.BasePoint);
EdwardsCurve.prototype.pointFromJSON = function pointFromJSON(obj) {
  return Point.fromJSON(this, obj);
};
EdwardsCurve.prototype.point = function point(x, y, z, t) {
  return new Point(this, x, y, z, t);
};
Point.fromJSON = function fromJSON(curve, obj) {
  return new Point(curve, obj[0], obj[1], obj[2]);
};
Point.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC Point Infinity>';
  return '<EC Point x: ' + this.x.fromRed().toString(16, 2) + ' y: ' + this.y.fromRed().toString(16, 2) + ' z: ' + this.z.fromRed().toString(16, 2) + '>';
};
Point.prototype.isInfinity = function isInfinity() {
  return this.x.cmpn(0) === 0 && this.y.cmp(this.z) === 0;
};
Point.prototype._extDbl = function _extDbl() {
  var a = this.x.redSqr();
  var b = this.y.redSqr();
  var c = this.z.redSqr();
  c = c.redIAdd(c);
  var d = this.curve._mulA(a);
  var e = this.x.redAdd(this.y).redSqr().redISub(a).redISub(b);
  var g = d.redAdd(b);
  var f = g.redSub(c);
  var h = d.redSub(b);
  var nx = e.redMul(f);
  var ny = g.redMul(h);
  var nt = e.redMul(h);
  var nz = f.redMul(g);
  return this.curve.point(nx, ny, nz, nt);
};
Point.prototype._projDbl = function _projDbl() {
  var b = this.x.redAdd(this.y).redSqr();
  var c = this.x.redSqr();
  var d = this.y.redSqr();
  var nx;
  var ny;
  var nz;
  if (this.curve.twisted) {
    var e = this.curve._mulA(c);
    var f = e.redAdd(d);
    if (this.zOne) {
      nx = b.redSub(c).redSub(d).redMul(f.redSub(this.curve.two));
      ny = f.redMul(e.redSub(d));
      nz = f.redSqr().redSub(f).redSub(f);
    } else {
      var h = this.z.redSqr();
      var j = f.redSub(h).redISub(h);
      nx = b.redSub(c).redISub(d).redMul(j);
      ny = f.redMul(e.redSub(d));
      nz = f.redMul(j);
    }
  } else {
    var e = c.redAdd(d);
    var h = this.curve._mulC(this.c.redMul(this.z)).redSqr();
    var j = e.redSub(h).redSub(h);
    nx = this.curve._mulC(b.redISub(e)).redMul(j);
    ny = this.curve._mulC(e).redMul(c.redISub(d));
    nz = e.redMul(j);
  }
  return this.curve.point(nx, ny, nz);
};
Point.prototype.dbl = function dbl() {
  if (this.isInfinity())
    return this;
  if (this.curve.extended)
    return this._extDbl();
  else
    return this._projDbl();
};
Point.prototype._extAdd = function _extAdd(p) {
  var a = this.y.redSub(this.x).redMul(p.y.redSub(p.x));
  var b = this.y.redAdd(this.x).redMul(p.y.redAdd(p.x));
  var c = this.t.redMul(this.curve.dd).redMul(p.t);
  var d = this.z.redMul(p.z.redAdd(p.z));
  var e = b.redSub(a);
  var f = d.redSub(c);
  var g = d.redAdd(c);
  var h = b.redAdd(a);
  var nx = e.redMul(f);
  var ny = g.redMul(h);
  var nt = e.redMul(h);
  var nz = f.redMul(g);
  return this.curve.point(nx, ny, nz, nt);
};
Point.prototype._projAdd = function _projAdd(p) {
  var a = this.z.redMul(p.z);
  var b = a.redSqr();
  var c = this.x.redMul(p.x);
  var d = this.y.redMul(p.y);
  var e = this.curve.d.redMul(c).redMul(d);
  var f = b.redSub(e);
  var g = b.redAdd(e);
  var tmp = this.x.redAdd(this.y).redMul(p.x.redAdd(p.y)).redISub(c).redISub(d);
  var nx = a.redMul(f).redMul(tmp);
  var ny;
  var nz;
  if (this.curve.twisted) {
    ny = a.redMul(g).redMul(d.redSub(this.curve._mulA(c)));
    nz = f.redMul(g);
  } else {
    ny = a.redMul(g).redMul(d.redSub(c));
    nz = this.curve._mulC(f).redMul(g);
  }
  return this.curve.point(nx, ny, nz);
};
Point.prototype.add = function add(p) {
  if (this.isInfinity())
    return p;
  if (p.isInfinity())
    return this;
  if (this.curve.extended)
    return this._extAdd(p);
  else
    return this._projAdd(p);
};
Point.prototype.mul = function mul(k) {
  if (this._hasDoubles(k))
    return this.curve._fixedNafMul(this, k);
  else
    return this.curve._wnafMul(this, k);
};
Point.prototype.mulAdd = function mulAdd(k1, p, k2) {
  return this.curve._wnafMulAdd(1, [this, p], [k1, k2], 2);
};
Point.prototype.normalize = function normalize() {
  if (this.zOne)
    return this;
  var zi = this.z.redInvm();
  this.x = this.x.redMul(zi);
  this.y = this.y.redMul(zi);
  if (this.t)
    this.t = this.t.redMul(zi);
  this.z = this.curve.one;
  this.zOne = true;
  return this;
};
Point.prototype.neg = function neg() {
  return this.curve.point(this.x.redNeg(), this.y, this.z, this.t && this.t.redNeg());
};
Point.prototype.getX = function getX() {
  this.normalize();
  return this.x.fromRed();
};
Point.prototype.getY = function getY() {
  this.normalize();
  return this.y.fromRed();
};
Point.prototype.eq = function eq(other) {
  return this === other || this.getX().cmp(other.getX()) === 0 && this.getY().cmp(other.getY()) === 0;
};
Point.prototype.toP = Point.prototype.normalize;
Point.prototype.mixedAdd = Point.prototype.add;
