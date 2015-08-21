
define(
    function (require) {
        var Base = require('./Base');
        var util = require('../tool/util');
        var zrColor = require('../tool/color');
        var LineShape = require('../shape/Line');

        function DynamicLine(options) {
            Base.call(this, options);
        }
        util.inherits(DynamicLine, Base);


        /**
         * 动态线
         * 
         * @param {Object} addShapeHandle
         * @param {Object} refreshHandle
         */
        DynamicLine.prototype._start = function (addShapeHandle, refreshHandle) {
            // 特效默认配置
            var options = util.merge(
                this.options,
                {
                    textStyle : {
                        color : '#fff'
                    },
                    backgroundColor : 'rgba(0, 0, 0, 0.8)',
                    effectOption : {
                        n : 30,
                        lineWidth : 1,
                        color : 'random',
                        timeInterval : 100
                    }
                }
            );

            var textShape = this.createTextShape(options.textStyle);
            var background = this.createBackgroundShape(options.backgroundColor);

            var effectOption = options.effectOption;
            var n = effectOption.n;
            var lineWidth = effectOption.lineWidth;

            var shapeList = [];
            var canvasWidth = this.canvasWidth;
            var canvasHeight = this.canvasHeight;
            
            // 初始化动画元素
            for (var i = 0; i < n; i++) {
                var xStart = -Math.ceil(Math.random() * 1000);
                var len = Math.ceil(Math.random() * 400);
                var pos = Math.ceil(Math.random() * canvasHeight);

                var color = effectOption.color == 'random'
                    ? zrColor.random()
                    : effectOption.color;
                
                shapeList[i] = new LineShape({
                    highlightStyle : {
                        xStart : xStart,
                        yStart : pos,
                        xEnd : xStart + len,
                        yEnd : pos,
                        strokeColor : color,
                        lineWidth : lineWidth
                    },
                    animationX : Math.ceil(Math.random() * 100),
                    len : len
                });
            }
            
            return setInterval(
                function() {
                    addShapeHandle(background);
                    
                    for (var i = 0; i < n; i++) {
                        var style = shapeList[i].highlightStyle;

                        if (style.xStart >= canvasWidth) {
                            
                            shapeList[i].len = Math.ceil(Math.random() * 400);
                            style.xStart = -400;
                            style.xEnd = -400 + shapeList[i].len;
                            style.yStart = Math.ceil(Math.random() * canvasHeight);
                            style.yEnd = style.yStart;
                        }

                        style.xStart += shapeList[i].animationX;
                        style.xEnd += shapeList[i].animationX;

                        addShapeHandle(shapeList[i]);
                    }

                    addShapeHandle(textShape);
                    refreshHandle();
                },
                effectOption.timeInterval
            );
        };

        return DynamicLine;
    }
);
