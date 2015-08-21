
define(
    function (require) {
        var Base = require('./Base');
        var util = require('../tool/util');
        var zrColor = require('../tool/color');
        var RingShape = require('../shape/Ring');
        var SectorShape = require('../shape/Sector');

        function Ring(options) {
            Base.call(this, options);
        }
        util.inherits(Ring, Base);


        /**
         * 圆环
         * 
         * @param {Object} addShapeHandle
         * @param {Object} refreshHandle
         */
        Ring.prototype._start = function (addShapeHandle, refreshHandle) {
            
            // 特效默认配置
            var options = util.merge(
                this.options,
                {
                    textStyle : {
                        color : '#07a'
                    },
                    backgroundColor : 'rgba(250, 250, 250, 0.8)',
                    effect : {
                        x : this.canvasWidth / 2,
                        y : this.canvasHeight / 2,
                        r0 : 60,
                        r : 100,
                        color : '#bbdcff',
                        brushType: 'fill',
                        textPosition : 'inside',
                        textFont : 'normal 30px verdana',
                        textColor : 'rgba(30, 144, 255, 0.6)',
                        timeInterval : 100
                    }
                }
            );

            var effectOption = options.effect;

            var textStyle = options.textStyle;
            if (textStyle.x == null) {
                textStyle.x = effectOption.x;
            }
            if (textStyle.y == null) {
                textStyle.y = (effectOption.y + (effectOption.r0 + effectOption.r) / 2 - 5);
            }
            
            var textShape = this.createTextShape(options.textStyle);
            var background = this.createBackgroundShape(options.backgroundColor);

            var x = effectOption.x;
            var y = effectOption.y;
            var r0 = effectOption.r0 + 6;
            var r = effectOption.r - 6;
            var color = effectOption.color;
            var darkColor = zrColor.lift(color, 0.1);

            var shapeRing = new RingShape({
                highlightStyle : util.clone(effectOption)
            });

            // 初始化动画元素
            var shapeList = [];
            var clolrList = zrColor.getGradientColors(
                [ '#ff6400', '#ffe100', '#97ff00' ], 25
            );
            var preAngle = 15;
            var endAngle = 240;

            for (var i = 0; i < 16; i++) {
                shapeList.push(new SectorShape({
                    highlightStyle  : {
                        x : x,
                        y : y,
                        r0 : r0,
                        r : r,
                        startAngle : endAngle - preAngle,
                        endAngle : endAngle,
                        brushType: 'fill',
                        color : darkColor
                    },
                    _color : zrColor.getLinearGradient(
                        x + r0 * Math.cos(endAngle, true),
                        y - r0 * Math.sin(endAngle, true),
                        x + r0 * Math.cos(endAngle - preAngle, true),
                        y - r0 * Math.sin(endAngle - preAngle, true),
                        [
                            [ 0, clolrList[i * 2] ],
                            [ 1, clolrList[i * 2 + 1] ]
                        ]
                    )
                }));
                endAngle -= preAngle;
            }
            endAngle = 360;
            for (var i = 0; i < 4; i++) {
                shapeList.push(new SectorShape({
                    highlightStyle  : {
                        x : x,
                        y : y,
                        r0 : r0,
                        r : r,
                        startAngle : endAngle - preAngle,
                        endAngle : endAngle,
                        brushType: 'fill',
                        color : darkColor
                    },
                    _color : zrColor.getLinearGradient(
                        x + r0 * Math.cos(endAngle, true),
                        y - r0 * Math.sin(endAngle, true),
                        x + r0 * Math.cos(endAngle - preAngle, true),
                        y - r0 * Math.sin(endAngle - preAngle, true),
                        [
                            [ 0, clolrList[i * 2 + 32] ],
                            [ 1, clolrList[i * 2 + 33] ]
                        ]
                    )
                }));
                endAngle -= preAngle;
            }

            var n = 0;
            if (options.progress != null) {
                // 指定进度
                addShapeHandle(background);

                n = this.adjust(options.progress, [ 0, 1 ]).toFixed(2) * 100 / 5;
                shapeRing.highlightStyle.text = n * 5 + '%';
                addShapeHandle(shapeRing);

                for (var i = 0; i < 20; i++) {
                    shapeList[i].highlightStyle.color = i < n
                        ? shapeList[i]._color : darkColor;
                    addShapeHandle(shapeList[i]);
                }

                addShapeHandle(textShape);
                refreshHandle();
                return;
            }

            // 循环显示
            return setInterval(
                function() {
                    addShapeHandle(background);

                    n += n >= 20 ? -20 : 1;

                    // shapeRing.highlightStyle.text = n * 5 + '%';
                    addShapeHandle(shapeRing);

                    for (var i = 0; i < 20; i++) {
                        shapeList[i].highlightStyle.color = i < n
                            ? shapeList[i]._color : darkColor;
                        addShapeHandle(shapeList[i]);
                    }

                    addShapeHandle(textShape);
                    refreshHandle();
                },
                effectOption.timeInterval
            );
        };

        return Ring;
    }
);
