/**
 * 折线
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @module zrender/shape/Polyline
 * @example
 *     var Polyline = require('zrender/shape/Polyline');
 *     var shape = new Polyline({
 *         style: {
 *             pointList: [[0, 0], [100, 100], [100, 0]],
 *             smooth: 'bezier',
 *             strokeColor: 'purple'
 *         }
 *     });
 *     zr.addShape(shape);
 */

/**
 * @typedef {Object} IPolylineStyle
 * @property {Array.<number>} pointList 顶点坐标数组
 * @property {string|number} [smooth=''] 是否做平滑插值, 平滑算法可以选择 bezier, spline
 * @property {number} [smoothConstraint] 平滑约束
 * @property {string} [strokeColor='#000000'] 描边颜色
 * @property {string} [lineCape='butt'] 线帽样式，可以是 butt, round, square
 * @property {string} [lineJoin='miter'] 线段连接样式，可以是 miter, round, bevel
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
define(
    function (require) {
        var Base = require('./Base');
        var smoothSpline = require('./util/smoothSpline');
        var smoothBezier = require('./util/smoothBezier');
        var dashedLineTo = require('./util/dashedLineTo');

        /**
         * @alias module:zrender/shape/Polyline
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Polyline = function(options) {
            this.brushTypeOnly = 'stroke';  // 线条只能描边，填充后果自负
            this.textPosition = 'end';
            Base.call(this, options);
            /**
             * 贝赛尔曲线绘制样式
             * @name module:zrender/shape/Polyline#style
             * @type {module:zrender/shape/Polyline~IPolylineStyle}
             */
            /**
             * 贝赛尔曲线高亮绘制样式
             * @name module:zrender/shape/Polyline#highlightStyle
             * @type {module:zrender/shape/Polyline~IPolylineStyle}
             */
        };

        Polyline.prototype =  {
            type: 'polyline',

            /**
             * 创建多边形路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Polyline~IPolylineStyle} style
             */
            buildPath : function(ctx, style) {
                var pointList = style.pointList;
                if (pointList.length < 2) {
                    // 少于2个点就不画了~
                    return;
                }
                
                var len = Math.min(
                    style.pointList.length, 
                    Math.round(style.pointListLength || style.pointList.length)
                );
                
                if (style.smooth && style.smooth !== 'spline') {
                    if (! style.controlPointList) {
                        this.updateControlPoints(style);
                    }
                    var controlPointList = style.controlPointList;

                    ctx.moveTo(pointList[0][0], pointList[0][1]);
                    var cp1;
                    var cp2;
                    var p;
                    for (var i = 0; i < len - 1; i++) {
                        cp1 = controlPointList[i * 2];
                        cp2 = controlPointList[i * 2 + 1];
                        p = pointList[i + 1];
                        ctx.bezierCurveTo(
                            cp1[0], cp1[1], cp2[0], cp2[1], p[0], p[1]
                        );
                    }
                }
                else {
                    if (style.smooth === 'spline') {
                        pointList = smoothSpline(pointList);
                        len = pointList.length;
                    }
                    if (!style.lineType || style.lineType == 'solid') {
                        // 默认为实线
                        ctx.moveTo(pointList[0][0], pointList[0][1]);
                        for (var i = 1; i < len; i++) {
                            ctx.lineTo(pointList[i][0], pointList[i][1]);
                        }
                    }
                    else if (style.lineType == 'dashed'
                            || style.lineType == 'dotted'
                    ) {
                        var dashLength = (style.lineWidth || 1) 
                                         * (style.lineType == 'dashed' ? 5 : 1);
                        ctx.moveTo(pointList[0][0], pointList[0][1]);
                        for (var i = 1; i < len; i++) {
                            dashedLineTo(
                                ctx,
                                pointList[i - 1][0], pointList[i - 1][1],
                                pointList[i][0], pointList[i][1],
                                dashLength
                            );
                        }
                    }
                }
                return;
            },

            updateControlPoints: function (style) {
                style.controlPointList = smoothBezier(
                    style.pointList, style.smooth, false, style.smoothConstraint
                );
            },

            /**
             * 计算返回折线包围盒矩形。
             * @param {IZRenderBezierCurveStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function(style) {
                return require('./Polygon').prototype.getRect(style);
            }
        };

        require('../tool/util').inherits(Polyline, Base);
        return Polyline;
    }
);
