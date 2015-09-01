/**
 * SVG Path
 * @module zrender/shape/Path
 * @see http://www.w3.org/TR/2011/REC-SVG11-20110816/paths.html#PathData
 * @author: Pissang (shenyi.914@gmail.com)
 */

/**
 * @typedef {Object} IPathStyle
 * @property {string} path path描述数据, 详见 {@link http://www.w3.org/TR/2011/REC-SVG11-20110816/paths.html#PathData}
 * @property {number} x x轴位移
 * @property {number} y y轴位移
 * @property {string} [brushType='fill']
 * @property {string} [color='#000000'] 填充颜色
 * @property {string} [strokeColor='#000000'] 描边颜色
 * @property {string} [lineCape='butt'] 线帽样式，可以是 butt, round, square
 * @property {number} [lineWidth=1] 描边宽度
 * @property {number} [opacity=1] 绘制透明度
 * @property {number} [shadowBlur=0] 阴影模糊度，大于0有效
 * @property {string} [shadowColor='#000000'] 阴影颜色
 * @property {number} [shadowOffsetX=0] 阴影横向偏移
 * @property {number} [shadowOffsetY=0] 阴影纵向偏移
 * @property {string} [text] 图形中的附加文本
 * @property {string} [textColor='#000000'] 文本颜色
 * @property {string} [textFont] 附加文本样式，eg:'bold 18px verdana'
 * @property {string} [textPosition='end'] 附加文本位置, 可以是 inside, left, right, top, bottom
 * @property {string} [textAlign] 默认根据textPosition自动设置，附加文本水平对齐。
 *                                可以是start, end, left, right, center
 * @property {string} [textBaseline] 默认根据textPosition自动设置，附加文本垂直对齐。
 *                                可以是top, bottom, middle, alphabetic, hanging, ideographic
 */
define(function (require) {

    var Base = require('./Base');
    var PathProxy = require('./util/PathProxy');
    var PathSegment = PathProxy.PathSegment;

    var vMag = function(v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    };
    var vRatio = function(u, v) {
        return (u[0] * v[0] + u[1] * v[1]) / (vMag(u) * vMag(v));
    };
    var vAngle = function(u, v) {
        return (u[0] * v[1] < u[1] * v[0] ? -1 : 1)
                * Math.acos(vRatio(u, v));
    };
    /**
     * @alias module:zrender/shape/Path
     * @constructor
     * @extends module:zrender/shape/Base
     * @param {Object} options
     */
    var Path = function (options) {
        Base.call(this, options);
        /**
         * Path绘制样式
         * @name module:zrender/shape/Path#style
         * @type {module:zrender/shape/Path~IPathStyle}
         */
        /**
         * Path高亮绘制样式
         * @name module:zrender/shape/Path#highlightStyle
         * @type {module:zrender/shape/Path~IPathStyle}
         */
    };

    Path.prototype = {
        type: 'path',

        buildPathArray : function (data, x, y) {
            if (!data) {
                return [];
            }

            // 平移
            x = x || 0;
            y = y || 0;
            // command string
            var cs = data;

            // command chars
            var cc = [
                'm', 'M', 'l', 'L', 'v', 'V', 'h', 'H', 'z', 'Z',
                'c', 'C', 'q', 'Q', 't', 'T', 's', 'S', 'a', 'A'
            ];
            
            cs = cs.replace(/-/g, ' -');
            cs = cs.replace(/  /g, ' ');
            cs = cs.replace(/ /g, ',');
            cs = cs.replace(/,,/g, ',');
            
            var n;
            // create pipes so that we can split the data
            for (n = 0; n < cc.length; n++) {
                cs = cs.replace(new RegExp(cc[n], 'g'), '|' + cc[n]);
            }

            // create array
            var arr = cs.split('|');
            var ca = [];
            // init context point
            var cpx = 0;
            var cpy = 0;
            for (n = 1; n < arr.length; n++) {
                var str = arr[n];
                var c = str.charAt(0);
                str = str.slice(1);
                str = str.replace(new RegExp('e,-', 'g'), 'e-');

                var p = str.split(',');
                if (p.length > 0 && p[0] === '') {
                    p.shift();
                }

                for (var i = 0; i < p.length; i++) {
                    p[i] = parseFloat(p[i]);
                }
                while (p.length > 0) {
                    if (isNaN(p[0])) {
                        break;
                    }
                    var cmd = null;
                    var points = [];

                    var ctlPtx;
                    var ctlPty;
                    var prevCmd;

                    var rx;
                    var ry;
                    var psi;
                    var fa;
                    var fs;

                    var x1 = cpx;
                    var y1 = cpy;

                    // convert l, H, h, V, and v to L
                    switch (c) {
                        case 'l':
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'L':
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'm':
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'M';
                            points.push(cpx, cpy);
                            c = 'l';
                            break;
                        case 'M':
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'M';
                            points.push(cpx, cpy);
                            c = 'L';
                            break;

                        case 'h':
                            cpx += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'H':
                            cpx = p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'v':
                            cpy += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'V':
                            cpy = p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'C':
                            points.push(p.shift(), p.shift(), p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'c':
                            points.push(
                                cpx + p.shift(), cpy + p.shift(),
                                cpx + p.shift(), cpy + p.shift()
                            );
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 'S':
                            ctlPtx = cpx;
                            ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'C') {
                                ctlPtx = cpx + (cpx - prevCmd.points[2]);
                                ctlPty = cpy + (cpy - prevCmd.points[3]);
                            }
                            points.push(ctlPtx, ctlPty, p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 's':
                            ctlPtx = cpx, ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'C') {
                                ctlPtx = cpx + (cpx - prevCmd.points[2]);
                                ctlPty = cpy + (cpy - prevCmd.points[3]);
                            }
                            points.push(
                                ctlPtx, ctlPty,
                                cpx + p.shift(), cpy + p.shift()
                            );
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 'Q':
                            points.push(p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'q':
                            points.push(cpx + p.shift(), cpy + p.shift());
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'Q';
                            points.push(cpx, cpy);
                            break;
                        case 'T':
                            ctlPtx = cpx, ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'Q') {
                                ctlPtx = cpx + (cpx - prevCmd.points[0]);
                                ctlPty = cpy + (cpy - prevCmd.points[1]);
                            }
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'Q';
                            points.push(ctlPtx, ctlPty, cpx, cpy);
                            break;
                        case 't':
                            ctlPtx = cpx, ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'Q') {
                                ctlPtx = cpx + (cpx - prevCmd.points[0]);
                                ctlPty = cpy + (cpy - prevCmd.points[1]);
                            }
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'Q';
                            points.push(ctlPtx, ctlPty, cpx, cpy);
                            break;
                        case 'A':
                            rx = p.shift();
                            ry = p.shift();
                            psi = p.shift();
                            fa = p.shift();
                            fs = p.shift();

                            x1 = cpx, y1 = cpy;
                            cpx = p.shift(), cpy = p.shift();
                            cmd = 'A';
                            points = this._convertPoint(
                                x1, y1, cpx, cpy, fa, fs, rx, ry, psi
                            );
                            break;
                        case 'a':
                            rx = p.shift();
                            ry = p.shift();
                            psi = p.shift();
                            fa = p.shift();
                            fs = p.shift();

                            x1 = cpx, y1 = cpy;
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'A';
                            points = this._convertPoint(
                                x1, y1, cpx, cpy, fa, fs, rx, ry, psi
                            );
                            break;
                    }

                    // 平移变换
                    for (var j = 0, l = points.length; j < l; j += 2) {
                        points[j] += x;
                        points[j + 1] += y;
                    }
                    ca.push(new PathSegment(
                        cmd || c, points
                    ));
                }

                if (c === 'z' || c === 'Z') {
                    ca.push(new PathSegment('z', []));
                }
            }

            return ca;
        },

        _convertPoint : function (x1, y1, x2, y2, fa, fs, rx, ry, psiDeg) {
            var psi = psiDeg * (Math.PI / 180.0);
            var xp = Math.cos(psi) * (x1 - x2) / 2.0
                     + Math.sin(psi) * (y1 - y2) / 2.0;
            var yp = -1 * Math.sin(psi) * (x1 - x2) / 2.0
                     + Math.cos(psi) * (y1 - y2) / 2.0;

            var lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);

            if (lambda > 1) {
                rx *= Math.sqrt(lambda);
                ry *= Math.sqrt(lambda);
            }

            var f = Math.sqrt((((rx * rx) * (ry * ry))
                    - ((rx * rx) * (yp * yp))
                    - ((ry * ry) * (xp * xp))) / ((rx * rx) * (yp * yp)
                    + (ry * ry) * (xp * xp))
                );

            if (fa === fs) {
                f *= -1;
            }
            if (isNaN(f)) {
                f = 0;
            }

            var cxp = f * rx * yp / ry;
            var cyp = f * -ry * xp / rx;

            var cx = (x1 + x2) / 2.0
                     + Math.cos(psi) * cxp
                     - Math.sin(psi) * cyp;
            var cy = (y1 + y2) / 2.0
                    + Math.sin(psi) * cxp
                    + Math.cos(psi) * cyp;

            var theta = vAngle([ 1, 0 ], [ (xp - cxp) / rx, (yp - cyp) / ry ]);
            var u = [ (xp - cxp) / rx, (yp - cyp) / ry ];
            var v = [ (-1 * xp - cxp) / rx, (-1 * yp - cyp) / ry ];
            var dTheta = vAngle(u, v);

            if (vRatio(u, v) <= -1) {
                dTheta = Math.PI;
            }
            if (vRatio(u, v) >= 1) {
                dTheta = 0;
            }
            if (fs === 0 && dTheta > 0) {
                dTheta = dTheta - 2 * Math.PI;
            }
            if (fs === 1 && dTheta < 0) {
                dTheta = dTheta + 2 * Math.PI;
            }
            return [ cx, cy, rx, ry, theta, dTheta, psi, fs ];
        },

        /**
         * 创建路径
         * @param {CanvasRenderingContext2D} ctx
         * @param {module:zrender/shape/Path~IPathStyle} style
         */
        buildPath : function (ctx, style) {
            var path = style.path;

            // 平移坐标
            var x = style.x || 0;
            var y = style.y || 0;

            style.pathArray = style.pathArray || this.buildPathArray(path, x, y);
            var pathArray = style.pathArray;

            // 记录边界点，用于判断inside
            var pointList = style.pointList = [];
            var singlePointList = [];
            for (var i = 0, l = pathArray.length; i < l; i++) {
                if (pathArray[i].command.toUpperCase() == 'M') {
                    singlePointList.length > 0 
                    && pointList.push(singlePointList);
                    singlePointList = [];
                }
                var p = pathArray[i].points;
                for (var j = 0, k = p.length; j < k; j += 2) {
                    singlePointList.push([p[j], p[j + 1]]);
                }
            }
            singlePointList.length > 0 && pointList.push(singlePointList);
            
            for (var i = 0, l = pathArray.length; i < l; i++) {
                var c = pathArray[i].command;
                var p = pathArray[i].points;
                switch (c) {
                    case 'L':
                        ctx.lineTo(p[0], p[1]);
                        break;
                    case 'M':
                        ctx.moveTo(p[0], p[1]);
                        break;
                    case 'C':
                        ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
                        break;
                    case 'Q':
                        ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
                        break;
                    case 'A':
                        var cx = p[0];
                        var cy = p[1];
                        var rx = p[2];
                        var ry = p[3];
                        var theta = p[4];
                        var dTheta = p[5];
                        var psi = p[6];
                        var fs = p[7];
                        var r = (rx > ry) ? rx : ry;
                        var scaleX = (rx > ry) ? 1 : rx / ry;
                        var scaleY = (rx > ry) ? ry / rx : 1;

                        ctx.translate(cx, cy);
                        ctx.rotate(psi);
                        ctx.scale(scaleX, scaleY);
                        ctx.arc(0, 0, r, theta, theta + dTheta, 1 - fs);
                        ctx.scale(1 / scaleX, 1 / scaleY);
                        ctx.rotate(-psi);
                        ctx.translate(-cx, -cy);
                        break;
                    case 'z':
                        ctx.closePath();
                        break;
                }
            }

            return;
        },

        /**
         * 计算返回Path包围盒矩形。
         * @param {module:zrender/shape/Path~IPathStyle} style
         * @return {module:zrender/shape/Base~IBoundingRect}
         */
        getRect : function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            
            var lineWidth;
            if (style.brushType == 'stroke' || style.brushType == 'fill') {
                lineWidth = style.lineWidth || 1;
            }
            else {
                lineWidth = 0;
            }

            var minX = Number.MAX_VALUE;
            var maxX = Number.MIN_VALUE;

            var minY = Number.MAX_VALUE;
            var maxY = Number.MIN_VALUE;

            // 平移坐标
            var x = style.x || 0;
            var y = style.y || 0;

            var pathArray = style.pathArray || this.buildPathArray(style.path);
            for (var i = 0; i < pathArray.length; i++) {
                var p = pathArray[i].points;

                for (var j = 0; j < p.length; j++) {
                    if (j % 2 === 0) {
                        if (p[j] + x < minX) {
                            minX = p[j];
                        }
                        if (p[j] + x > maxX) {
                            maxX = p[j];
                        }
                    } 
                    else {
                        if (p[j] + y < minY) {
                            minY = p[j];
                        }
                        if (p[j] + y > maxY) {
                            maxY = p[j];
                        }
                    }
                }
            }

            var rect;
            if (minX === Number.MAX_VALUE
                || maxX === Number.MIN_VALUE
                || minY === Number.MAX_VALUE
                || maxY === Number.MIN_VALUE
            ) {
                rect = {
                    x : 0,
                    y : 0,
                    width : 0,
                    height : 0
                };
            }
            else {
                rect = {
                    x : Math.round(minX - lineWidth / 2),
                    y : Math.round(minY - lineWidth / 2),
                    width : maxX - minX + lineWidth,
                    height : maxY - minY + lineWidth
                };
            }
            style.__rect = rect;
            return rect;
        }
    };

    require('../tool/util').inherits(Path, Base);
    return Path;
});
