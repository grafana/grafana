/**
 * echarts图表特效基类
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var ecData = require('../util/ecData');
    
    var CircleShape = require('zrender/shape/Circle');
    var ImageShape = require('zrender/shape/Image');
    var curveTool = require('zrender/tool/curve');
    var IconShape = require('../util/shape/Icon');
    var SymbolShape = require('../util/shape/Symbol');
    var ShapeBundle = require('zrender/shape/ShapeBundle');
    var Polyline = require('zrender/shape/Polyline');
    var vec2 = require('zrender/tool/vector');

    var canvasSupported = require('zrender/tool/env').canvasSupported;
    
    function point(zr, effectList, shape, zlevel) {
        var effect = shape.effect;
        var color = effect.color || shape.style.strokeColor || shape.style.color;
        var shadowColor = effect.shadowColor || color;
        var size = effect.scaleSize;
        var distance = effect.bounceDistance;
        var shadowBlur = typeof effect.shadowBlur != 'undefined'
                         ? effect.shadowBlur : size;

        var effectShape;
        if (shape.type !== 'image') {
            effectShape = new IconShape({
                zlevel : zlevel,
                style : {
                    brushType : 'stroke',
                    iconType : shape.style.iconType != 'droplet'
                               ? shape.style.iconType
                               : 'circle',
                    x : shadowBlur + 1, // 线宽
                    y : shadowBlur + 1,
                    n : shape.style.n,
                    width : shape.style._width * size,
                    height : shape.style._height * size,
                    lineWidth : 1,
                    strokeColor : color,
                    shadowColor : shadowColor,
                    shadowBlur : shadowBlur
                },
                draggable : false,
                hoverable : false
            });
            if (shape.style.iconType == 'pin') {
                effectShape.style.y += effectShape.style.height / 2 * 1.5;
            }

            if (canvasSupported) {  // 提高性能，换成image
                effectShape.style.image = zr.shapeToImage(
                    effectShape, 
                    effectShape.style.width + shadowBlur * 2 + 2, 
                    effectShape.style.height + shadowBlur * 2 + 2
                ).style.image;
                
                effectShape = new ImageShape({
                    zlevel : effectShape.zlevel,
                    style : effectShape.style,
                    draggable : false,
                    hoverable : false
                });
            }
        }
        else {
            effectShape = new ImageShape({
                zlevel : zlevel,
                style : shape.style,
                draggable : false,
                hoverable : false
            });
        }
        
        ecData.clone(shape, effectShape);
        
        // 改变坐标，不能移到前面
        effectShape.position = shape.position;
        effectList.push(effectShape);
        zr.addShape(effectShape);
        
        var devicePixelRatio = shape.type !== 'image' ? (window.devicePixelRatio || 1) : 1;
        var offset = (effectShape.style.width / devicePixelRatio - shape.style._width) / 2;
        effectShape.style.x = shape.style._x - offset;
        effectShape.style.y = shape.style._y - offset;

        if (shape.style.iconType == 'pin') {
            effectShape.style.y -= shape.style.height / 2 * 1.5;
        }

        var duration = (effect.period + Math.random() * 10) * 100;
        
        zr.modShape(
            shape.id, 
            { invisible : true}
        );
        
        var centerX = effectShape.style.x + (effectShape.style.width) / 2 / devicePixelRatio;
        var centerY = effectShape.style.y + (effectShape.style.height) / 2 / devicePixelRatio;

        if (effect.type === 'scale') {
            // 放大效果
            zr.modShape(
                effectShape.id, 
                {
                    scale : [0.1, 0.1, centerX, centerY]
                }
            );
            
            zr.animate(effectShape.id, '', effect.loop)
                .when(
                    duration,
                    {
                        scale : [1, 1, centerX, centerY]
                    }
                )
                .done(function() {
                    shape.effect.show = false;
                    zr.delShape(effectShape.id);
                })
                .start();
        }
        else {
            zr.animate(effectShape.id, 'style', effect.loop)
                .when(
                    duration,
                    {
                        y : effectShape.style.y - distance
                    }
                )
                .when(
                    duration * 2,
                    {
                        y : effectShape.style.y
                    }
                )
                .done(function() {
                    shape.effect.show = false;
                    zr.delShape(effectShape.id);
                })
                .start();
        }
        
    }
    
    function largePoint(zr, effectList, shape, zlevel) {
        var effect = shape.effect;
        var color = effect.color || shape.style.strokeColor || shape.style.color;
        var size = effect.scaleSize;
        var shadowColor = effect.shadowColor || color;
        var shadowBlur = typeof effect.shadowBlur != 'undefined'
                         ? effect.shadowBlur : (size * 2);
        var devicePixelRatio = window.devicePixelRatio || 1;
        var effectShape = new SymbolShape({
            zlevel : zlevel,
            position : shape.position,
            scale : shape.scale,
            style : {
                pointList : shape.style.pointList,
                iconType : shape.style.iconType,
                color : color,
                strokeColor : color,
                shadowColor : shadowColor,
                shadowBlur : shadowBlur * devicePixelRatio,
                random : true,
                brushType: 'fill',
                lineWidth:1,
                size : shape.style.size
            },
            draggable : false,
            hoverable : false
        });
        
        effectList.push(effectShape);
        zr.addShape(effectShape);
        zr.modShape(
            shape.id, 
            { invisible : true}
        );
        
        var duration = Math.round(effect.period * 100);
        var clip1 = {};
        var clip2 = {};
        for (var i = 0; i < 20; i++) {
            effectShape.style['randomMap' + i] = 0;
            clip1 = {};
            clip1['randomMap' + i] = 100;
            clip2 = {};
            clip2['randomMap' + i] = 0;
            effectShape.style['randomMap' + i] = Math.random() * 100;
            zr.animate(effectShape.id, 'style', true)
                .when(duration, clip1)
                .when(duration * 2, clip2)
                .when(duration * 3, clip1)
                .when(duration * 4, clip1)
                .delay(Math.random() * duration * i)
                //.delay(duration / 15 * (15 - i + 1))
                .start();
            
        }
    }
    
    function line(zr, effectList, shape, zlevel, isLarge) {
        var effect = shape.effect;
        var shapeStyle = shape.style;
        var color = effect.color || shapeStyle.strokeColor || shapeStyle.color;
        var shadowColor = effect.shadowColor || shapeStyle.strokeColor || color;
        var size = shapeStyle.lineWidth * effect.scaleSize;
        var shadowBlur = typeof effect.shadowBlur != 'undefined'
                         ? effect.shadowBlur : size;

        var effectShape = new CircleShape({
            zlevel : zlevel,
            style : {
                x : shadowBlur,
                y : shadowBlur,
                r : size,
                color : color,
                shadowColor : shadowColor,
                shadowBlur : shadowBlur
            },
            hoverable : false
        });

        var offset = 0;
        if (canvasSupported && ! isLarge) {  // 提高性能，换成image
            var zlevel = effectShape.zlevel;
            effectShape = zr.shapeToImage(
                effectShape,
                (size + shadowBlur) * 2,
                (size + shadowBlur) * 2
            );
            effectShape.zlevel = zlevel;
            effectShape.hoverable = false;

            offset = shadowBlur;
        }

        if (! isLarge) {
            ecData.clone(shape, effectShape);
            // 改变坐标， 不能移到前面
            effectShape.position = shape.position;
            effectList.push(effectShape);
            zr.addShape(effectShape);
        }

        var effectDone = function () {
            if (! isLarge) {
                shape.effect.show = false;
                zr.delShape(effectShape.id);   
            }
            effectShape.effectAnimator = null;
        };

        if (shape instanceof Polyline) {
            var distanceList = [0];
            var totalDist = 0;
            var pointList = shapeStyle.pointList;
            var controlPointList = shapeStyle.controlPointList;
            for (var i = 1; i < pointList.length; i++) {
                if (controlPointList) {
                    var cp1 = controlPointList[(i - 1) * 2];
                    var cp2 = controlPointList[(i - 1) * 2 + 1];
                    totalDist += vec2.dist(pointList[i - 1], cp1)
                         + vec2.dist(cp1, cp2)
                         + vec2.dist(cp2, pointList[i]);
                }
                else {
                    totalDist += vec2.dist(pointList[i - 1], pointList[i]);
                }
                distanceList.push(totalDist);
            }
            var obj = { p: 0 };
            var animator = zr.animation.animate(obj, { loop: effect.loop });

            for (var i = 0; i < distanceList.length; i++) {
                animator.when(distanceList[i] * effect.period, { p: i });
            }
            animator.during(function () {
                var i = Math.floor(obj.p);
                var x, y;
                if (i == pointList.length - 1) {
                    x = pointList[i][0];
                    y = pointList[i][1];
                }
                else {
                    var t = obj.p - i;
                    var p0 = pointList[i];
                    var p1 = pointList[i + 1];
                    if (controlPointList) {
                        var cp1 = controlPointList[i * 2];
                        var cp2 = controlPointList[i * 2 + 1];
                        x = curveTool.cubicAt(
                            p0[0], cp1[0], cp2[0], p1[0], t
                        );
                        y = curveTool.cubicAt(
                            p0[1], cp1[1], cp2[1], p1[1], t
                        );
                    }
                    else {
                        x = (p1[0] - p0[0]) * t + p0[0];
                        y = (p1[1] - p0[1]) * t + p0[1];   
                    }
                }
                effectShape.style.x = x;
                effectShape.style.y = y;
                if (! isLarge) {
                    zr.modShape(effectShape);
                }
            })
            .done(effectDone)
            .start();

            animator.duration = totalDist * effect.period;

            effectShape.effectAnimator = animator;
        }
        else {
            var x0 = shapeStyle.xStart - offset;
            var y0 = shapeStyle.yStart - offset;
            var x2 = shapeStyle.xEnd - offset;
            var y2 = shapeStyle.yEnd - offset;
            effectShape.style.x = x0;
            effectShape.style.y = y0;

            var distance = (x2 - x0) * (x2 - x0) + (y2 - y0) * (y2 - y0);
            var duration = Math.round(Math.sqrt(Math.round(
                distance * effect.period * effect.period
            )));

            if (shape.style.curveness > 0) {
                var x1 = shapeStyle.cpX1 - offset;
                var y1 = shapeStyle.cpY1 - offset;
                effectShape.effectAnimator = zr.animation.animate(effectShape, { loop: effect.loop })
                    .when(duration, { p: 1 })
                    .during(function (target, t) {
                        effectShape.style.x = curveTool.quadraticAt(
                            x0, x1, x2, t
                        );
                        effectShape.style.y = curveTool.quadraticAt(
                            y0, y1, y2, t
                        );
                        if (! isLarge) {
                            zr.modShape(effectShape);
                        }
                    })
                    .done(effectDone)
                    .start();
            }
            else {
                // 不用 zr.animate，因为在用 ShapeBundle 的时候单个 effectShape 不会
                // 被加到 zrender 中
                effectShape.effectAnimator = zr.animation.animate(effectShape.style, { loop: effect.loop })
                    .when(duration, {
                        x: x2,
                        y: y2
                    })
                    .during(function () {
                        if (! isLarge) {
                            zr.modShape(effectShape);
                        }
                    })
                    .done(effectDone)
                    .start();
            }
            effectShape.effectAnimator.duration = duration;
        }
        return effectShape;
    }

    function largeLine(zr, effectList, shape, zlevel) {
        var effectShape = new ShapeBundle({
            style: {
                shapeList: []
            },
            zlevel: zlevel,
            hoverable: false
        });
        var shapeList = shape.style.shapeList;
        var effect = shape.effect;
        effectShape.position = shape.position;

        var maxDuration = 0;
        var subEffectAnimators = [];
        for (var i = 0; i < shapeList.length; i++) {
            shapeList[i].effect = effect;
            var subEffectShape = line(zr, null, shapeList[i], zlevel, true);
            var subEffectAnimator = subEffectShape.effectAnimator;
            effectShape.style.shapeList.push(subEffectShape);
            if (subEffectAnimator.duration > maxDuration) {
                maxDuration = subEffectAnimator.duration;
            }
            if (i === 0) {
                effectShape.style.color = subEffectShape.style.color;
                effectShape.style.shadowBlur = subEffectShape.style.shadowBlur;
                effectShape.style.shadowColor = subEffectShape.style.shadowColor;
            }
            subEffectAnimators.push(subEffectAnimator);
        }
        effectList.push(effectShape);
        zr.addShape(effectShape);

        var clearAllAnimators = function () {
            for (var i = 0; i < subEffectAnimators.length; i++) {
                subEffectAnimators[i].stop();
            }
        };
        if (maxDuration) {
            effectShape.__dummy = 0;
            // Proxy animator
            var animator = zr.animate(effectShape.id, '', effect.loop)
                .when(maxDuration, {
                    __dummy: 1
                })
                .during(function () {
                    zr.modShape(effectShape);
                })
                .done(function () {
                    shape.effect.show = false;
                    zr.delShape(effectShape.id);
                })
                .start();
            var oldStop = animator.stop;

            animator.stop = function () {
                clearAllAnimators();
                oldStop.call(this);
            };
        }
    }

    return {
        point : point,
        largePoint : largePoint,
        line : line,
        largeLine: largeLine
    };
});
