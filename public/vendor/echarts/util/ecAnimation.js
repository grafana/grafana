/**
 * echarts图表动画基类
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var zrUtil = require('zrender/tool/util');
    var curveTool = require('zrender/tool/curve');
    
    /**
     * 折线型动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function pointList(zr, oldShape, newShape, duration, easing) {
        var newPointList = newShape.style.pointList;
        var newPointListLen = newPointList.length;
        var oldPointList;

        if (!oldShape) {        // add
            oldPointList = [];
            if (newShape._orient != 'vertical') {
                var y = newPointList[0][1];
                for (var i = 0; i < newPointListLen; i++) {
                    oldPointList[i] = [newPointList[i][0], y];
                }
            }
            else {
                var x = newPointList[0][0];
                for (var i = 0; i < newPointListLen; i++) {
                    oldPointList[i] = [x, newPointList[i][1]];
                }
            }

            if (newShape.type == 'half-smooth-polygon') {
                oldPointList[newPointListLen - 1] = zrUtil.clone(newPointList[newPointListLen - 1]);
                oldPointList[newPointListLen - 2] = zrUtil.clone(newPointList[newPointListLen - 2]);
            }
            oldShape = {style : {pointList : oldPointList}};
        }
        
        oldPointList = oldShape.style.pointList;
        var oldPointListLen = oldPointList.length;
        if (oldPointListLen == newPointListLen) {
            newShape.style.pointList = oldPointList;
        }
        else if (oldPointListLen < newPointListLen) {
            // 原来短，新的长，补全
            newShape.style.pointList = oldPointList.concat(newPointList.slice(oldPointListLen));
        }
        else {
            // 原来长，新的短，截断
            newShape.style.pointList = oldPointList.slice(0, newPointListLen);
        }

        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                { pointList: newPointList }
            )
            .during(function () {
                // Updating bezier points
                if (newShape.updateControlPoints) {
                    newShape.updateControlPoints(newShape.style);
                }
            })
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * 复制样式
     * 
     * @inner
     * @param {Object} target 目标对象
     * @param {Object} source 源对象
     * @param {...string} props 复制的属性列表
     */
    function cloneStyle(target, source) {
        var len = arguments.length;
        for (var i = 2; i < len; i++) {
            var prop = arguments[i];
            target.style[prop] = source.style[prop];
        }
    }

    /**
     * 方型动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function rectangle(zr, oldShape, newShape, duration, easing) {
        var newShapeStyle = newShape.style;
        if (!oldShape) {        // add
            oldShape = {
                position : newShape.position,
                style : {
                    x : newShapeStyle.x,
                    y : newShape._orient == 'vertical'
                        ? newShapeStyle.y + newShapeStyle.height
                        : newShapeStyle.y,
                    width: newShape._orient == 'vertical' 
                           ? newShapeStyle.width : 0,
                    height: newShape._orient != 'vertical' 
                           ? newShapeStyle.height : 0
                }
            };
        }
        
        var newX = newShapeStyle.x;
        var newY = newShapeStyle.y;
        var newWidth = newShapeStyle.width;
        var newHeight = newShapeStyle.height;
        var newPosition = [newShape.position[0], newShape.position[1]];
        cloneStyle(
            newShape, oldShape,
            'x', 'y', 'width', 'height'
        );
        newShape.position = oldShape.position;

        zr.addShape(newShape);
        if (newPosition[0] != oldShape.position[0] || newPosition[1] != oldShape.position[1]) {
            zr.animate(newShape.id, '')
                .when(
                    duration,
                    {
                        position: newPosition
                    }
                )
                .start(easing);
        }
        
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * 蜡烛动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function candle(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {        // add
            var y = newShape.style.y;
            oldShape = {style : {y : [y[0], y[0], y[0], y[0]]}};
        }
        
        var newY = newShape.style.y;
        newShape.style.y = oldShape.style.y;
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                { y: newY }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }

    /**
     * 环型动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function ring(zr, oldShape, newShape, duration, easing) {
        var x = newShape.style.x;
        var y = newShape.style.y;
        var r0 = newShape.style.r0;
        var r = newShape.style.r;
        
        newShape.__animating = true;

        if (newShape._animationAdd != 'r') {
            newShape.style.r0 = 0;
            newShape.style.r = 0;
            newShape.rotation = [Math.PI*2, x, y];
            
            zr.addShape(newShape);
            zr.animate(newShape.id, 'style')
                .when(
                    duration,
                    {
                        r0 : r0,
                        r : r
                    }
                )
                .done(function() {
                    newShape.__animating = false;
                })
                .start(easing);
            zr.animate(newShape.id, '')
                .when(
                    duration,
                    { rotation : [0, x, y] }
                )
                .start(easing);
        }
        else {
            newShape.style.r0 = newShape.style.r;
            
            zr.addShape(newShape);
            zr.animate(newShape.id, 'style')
                .when(
                    duration,
                    {
                        r0 : r0
                    }
                )
                .done(function() {
                    newShape.__animating = false;
                })
                .start(easing);
        }
    }
    
    /**
     * 扇形动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function sector(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {        // add
            if (newShape._animationAdd != 'r') {
                oldShape = {
                    style : {
                        startAngle : newShape.style.startAngle,
                        endAngle : newShape.style.startAngle
                    }
                };
            }
            else {
                oldShape = {style : {r0 : newShape.style.r}};
            }
        }
        
        var startAngle = newShape.style.startAngle;
        var endAngle = newShape.style.endAngle;
        
        cloneStyle(
            newShape, oldShape,
            'startAngle', 'endAngle'
        );
        
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    startAngle : startAngle,
                    endAngle : endAngle
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * 文本动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function text(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {        // add
            oldShape = {
                style : {
                    x : newShape.style.textAlign == 'left' 
                        ? newShape.style.x + 100
                        : newShape.style.x - 100,
                    y : newShape.style.y
                }
            };
        }
        
        var x = newShape.style.x;
        var y = newShape.style.y;
        
        cloneStyle(
            newShape, oldShape,
            'x', 'y'
        );
        
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    x : x,
                    y : y
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * 多边形动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function polygon(zr, oldShape, newShape, duration, easing) {
        var rect = require('zrender/shape/Polygon').prototype.getRect(newShape.style);
        var x = rect.x + rect.width / 2;
        var y = rect.y + rect.height / 2;
        
        newShape.scale = [0.1, 0.1, x, y];
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, '')
            .when(
                duration,
                {
                    scale : [1, 1, x, y]
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * 和弦动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function ribbon(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {        // add
            oldShape = {
                style : {
                    source0 : 0,
                    source1 : newShape.style.source1 > 0 ? 360 : -360,
                    target0 : 0,
                    target1 : newShape.style.target1 > 0 ? 360 : -360
                }
            };
        }
        
        var source0 = newShape.style.source0;
        var source1 = newShape.style.source1;
        var target0 = newShape.style.target0;
        var target1 = newShape.style.target1;
        
        if (oldShape.style) {
            cloneStyle(
                newShape, oldShape,
                'source0', 'source1', 'target0', 'target1'
            );
        }
        
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    source0 : source0,
                    source1 : source1,
                    target0 : target0,
                    target1 : target1
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * gaugePointer动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function gaugePointer(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {        // add
            oldShape = {
                style : {
                    angle : newShape.style.startAngle
                }
            };
        }
        
        var angle = newShape.style.angle;
        newShape.style.angle = oldShape.style.angle;
        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    angle : angle
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * icon动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function icon(zr, oldShape, newShape, duration, easing, delay) {
        // 避免markPoint特效取值在动画帧上
        newShape.style._x = newShape.style.x;
        newShape.style._y = newShape.style.y;
        newShape.style._width = newShape.style.width;
        newShape.style._height = newShape.style.height;

        if (!oldShape) {    // add
            var x = newShape._x || 0;
            var y = newShape._y || 0;
            newShape.scale = [0.01, 0.01, x, y];
            zr.addShape(newShape);
            newShape.__animating = true;
            zr.animate(newShape.id, '')
                .delay(delay)
                .when(
                    duration,
                    {scale : [1, 1, x, y]}
                )
                .done(function() {
                    newShape.__animating = false;
                })
                .start(easing || 'QuinticOut');
        }
        else {              // mod
            rectangle(zr, oldShape, newShape, duration, easing);
        }
    }
    
    /**
     * line动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function line(zr, oldShape, newShape, duration, easing) {
        if (!oldShape) {
            oldShape = {
                style : {
                    xStart : newShape.style.xStart,
                    yStart : newShape.style.yStart,
                    xEnd : newShape.style.xStart,
                    yEnd : newShape.style.yStart
                }
            };
        }
        
        var xStart = newShape.style.xStart;
        var xEnd = newShape.style.xEnd;
        var yStart = newShape.style.yStart;
        var yEnd = newShape.style.yEnd;

        cloneStyle(
            newShape, oldShape,
            'xStart', 'xEnd', 'yStart', 'yEnd'
        );

        zr.addShape(newShape);
        newShape.__animating = true;
        zr.animate(newShape.id, 'style')
            .when(
                duration,
                {
                    xStart: xStart,
                    xEnd: xEnd,
                    yStart: yStart,
                    yEnd: yEnd
                }
            )
            .done(function() {
                newShape.__animating = false;
            })
            .start(easing);
    }
    
    /**
     * markline动画
     * 
     * @param {ZRender} zr
     * @param {shape} oldShape
     * @param {shape} newShape
     * @param {number} duration
     * @param {tring} easing
     */
    function markline(zr, oldShape, newShape, duration, easing) {
        easing = easing || 'QuinticOut';
        newShape.__animating = true;
        zr.addShape(newShape);
        var newShapeStyle = newShape.style;

        var animationDone = function () {
            newShape.__animating = false;
        };
        var x0 = newShapeStyle.xStart;
        var y0 = newShapeStyle.yStart;
        var x2 = newShapeStyle.xEnd;
        var y2 = newShapeStyle.yEnd;
        if (newShapeStyle.curveness > 0) {
            newShape.updatePoints(newShapeStyle);
            var obj = { p: 0 };
            var x1 = newShapeStyle.cpX1;
            var y1 = newShapeStyle.cpY1;
            var newXArr = [];
            var newYArr = [];
            var subdivide = curveTool.quadraticSubdivide;
            zr.animation.animate(obj)
                .when(duration, { p: 1 })
                .during(function () {
                    // Calculate subdivided curve
                    subdivide(x0, x1, x2, obj.p, newXArr);
                    subdivide(y0, y1, y2, obj.p, newYArr);
                    newShapeStyle.cpX1 = newXArr[1];
                    newShapeStyle.cpY1 = newYArr[1];
                    newShapeStyle.xEnd = newXArr[2];
                    newShapeStyle.yEnd = newYArr[2];
                    zr.modShape(newShape);
                })
                .done(animationDone)
                .start(easing);
        }
        else {
            zr.animate(newShape.id, 'style')
                .when(0, {
                    xEnd: x0,
                    yEnd: y0
                })
                .when(duration, {
                    xEnd: x2,
                    yEnd: y2
                })
                .done(animationDone)
                .start(easing);
        }
    }

    return {
        pointList : pointList,
        rectangle : rectangle,
        candle : candle,
        ring : ring,
        sector : sector,
        text : text,
        polygon : polygon,
        ribbon : ribbon,
        gaugePointer : gaugePointer,
        icon : icon,
        line : line,
        markline : markline
    };
});
