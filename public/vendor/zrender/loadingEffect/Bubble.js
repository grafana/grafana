
define(
    function (require) {
        var Base = require('./Base');
        var util = require('../tool/util');
        var zrColor = require('../tool/color');
        var CircleShape = require('../shape/Circle');

        function Bubble(options) {
            Base.call(this, options);
        }
        util.inherits(Bubble, Base);

        /**
         * 泡泡
         *
         * @param {Object} addShapeHandle
         * @param {Object} refreshHandle
         */
        Bubble.prototype._start = function (addShapeHandle, refreshHandle) {
            
            // 特效默认配置
            var options = util.merge(
                this.options,
                {
                    textStyle : {
                        color : '#888'
                    },
                    backgroundColor : 'rgba(250, 250, 250, 0.8)',
                    effect : {
                        n : 50,
                        lineWidth : 2,
                        brushType : 'stroke',
                        color : 'random',
                        timeInterval : 100
                    }
                }
            );

            var textShape = this.createTextShape(options.textStyle);
            var background = this.createBackgroundShape(options.backgroundColor);

            var effectOption = options.effect;
            var n = effectOption.n;
            var brushType = effectOption.brushType;
            var lineWidth = effectOption.lineWidth;

            var shapeList = [];
            var canvasWidth = this.canvasWidth;
            var canvasHeight = this.canvasHeight;
            
            // 初始化动画元素
            for (var i = 0; i < n; i++) {
                var color = effectOption.color == 'random'
                    ? zrColor.alpha(zrColor.random(), 0.3)
                    : effectOption.color;

                shapeList[i] = new CircleShape({
                    highlightStyle : {
                        x : Math.ceil(Math.random() * canvasWidth),
                        y : Math.ceil(Math.random() * canvasHeight),
                        r : Math.ceil(Math.random() * 40),
                        brushType : brushType,
                        color : color,
                        strokeColor : color,
                        lineWidth : lineWidth
                    },
                    animationY : Math.ceil(Math.random() * 20)
                });
            }
            
            return setInterval(
                function () {
                    addShapeHandle(background);
                    
                    for (var i = 0; i < n; i++) {
                        var style = shapeList[i].highlightStyle;

                        if (style.y - shapeList[i].animationY + style.r <= 0) {
                            shapeList[i].highlightStyle.y = canvasHeight + style.r;
                            shapeList[i].highlightStyle.x = Math.ceil(
                                Math.random() * canvasWidth
                            );
                        }
                        shapeList[i].highlightStyle.y -=
                            shapeList[i].animationY;

                        addShapeHandle(shapeList[i]);
                    }

                    addShapeHandle(textShape);
                    refreshHandle();
                },
                effectOption.timeInterval
            );
        };

        return Bubble;
    }
);
