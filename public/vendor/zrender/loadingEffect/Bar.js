
define(
    function (require) {
        var Base = require('./Base');
        var util = require('../tool/util');
        var zrColor = require('../tool/color');
        var RectangleShape = require('../shape/Rectangle');

        function Bar(options) {
            Base.call(this, options);
        }
        util.inherits(Bar, Base);

        
        /**
         * 进度条
         * 
         * @param {Object} addShapeHandle
         * @param {Object} refreshHandle
         */
        Bar.prototype._start = function (addShapeHandle, refreshHandle) {
            // 特效默认配置
            var options = util.merge(
                this.options,
                {
                    textStyle : {
                        color : '#888'
                    },
                    backgroundColor : 'rgba(250, 250, 250, 0.8)',
                    effectOption : {
                        x : 0,
                        y : this.canvasHeight / 2 - 30,
                        width : this.canvasWidth,
                        height : 5,
                        brushType : 'fill',
                        timeInterval : 100
                    }
                }
            );

            var textShape = this.createTextShape(options.textStyle);
            var background = this.createBackgroundShape(options.backgroundColor);

            var effectOption = options.effectOption;

            // 初始化动画元素
            var barShape = new RectangleShape({
                highlightStyle : util.clone(effectOption)
            });

            barShape.highlightStyle.color =
                effectOption.color
                || zrColor.getLinearGradient(
                    effectOption.x,
                    effectOption.y,
                    effectOption.x + effectOption.width,
                    effectOption.y + effectOption.height,
                    [ [ 0, '#ff6400' ], [ 0.5, '#ffe100' ], [ 1, '#b1ff00' ] ]
                );

            if (options.progress != null) {
                // 指定进度
                addShapeHandle(background);

                barShape.highlightStyle.width =
                    this.adjust(options.progress, [ 0, 1 ])
                    * options.effectOption.width;
                    
                addShapeHandle(barShape);
                addShapeHandle(textShape);

                refreshHandle();
                return;
            }
            else {
                // 循环显示
                barShape.highlightStyle.width = 0;
                return setInterval(
                    function () {
                        addShapeHandle(background);

                        if (barShape.highlightStyle.width < effectOption.width) {
                            barShape.highlightStyle.width += 8;
                        }
                        else {
                            barShape.highlightStyle.width = 0;
                        }
                        addShapeHandle(barShape);
                        addShapeHandle(textShape);
                        refreshHandle();
                    },
                    effectOption.timeInterval
                );
            }
        };

        return Bar;
    }
);
