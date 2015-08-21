
define(
    function (require) {
        var Base = require('./Base');
        var util = require('../tool/util');
        var zrArea = require('../tool/area');
        var RingShape = require('../shape/Ring');
        var DropletShape = require('../shape/Droplet');
        var CircleShape = require('../shape/Circle');

        function Whirling(options) {
            Base.call(this, options);
        }
        util.inherits(Whirling, Base);

        /**
         * 旋转水滴
         * 
         * @param {Object} addShapeHandle
         * @param {Object} refreshHandle
         */
        Whirling.prototype._start = function (addShapeHandle, refreshHandle) {
            var options = util.merge(
                this.options,
                {
                    textStyle : {
                        color : '#888',
                        textAlign : 'start'
                    },
                    backgroundColor : 'rgba(250, 250, 250, 0.8)'
                }
            );
            var textShape = this.createTextShape(options.textStyle);
            
            var textGap = 10;
            var textWidth = zrArea.getTextWidth(
                textShape.highlightStyle.text, textShape.highlightStyle.textFont
            );
            var textHeight = zrArea.getTextHeight(
                textShape.highlightStyle.text, textShape.highlightStyle.textFont
            );
            
            // 特效默认配置
            var effectOption = util.merge(
                this.options.effect || {},
                {
                    r : 18,
                    colorIn : '#fff',
                    colorOut : '#555',
                    colorWhirl : '#6cf',
                    timeInterval : 50
                }
            );
            
            var location = this.getLocation(
                this.options.textStyle,
                textWidth + textGap + effectOption.r * 2,
                Math.max(effectOption.r * 2, textHeight)
            );
            effectOption.x = location.x + effectOption.r;
            effectOption.y = textShape.highlightStyle.y = location.y + location.height / 2;
            textShape.highlightStyle.x = effectOption.x + effectOption.r + textGap;
            
            var background = this.createBackgroundShape(options.backgroundColor);
            // 初始化动画元素
            var droplet = new DropletShape({
                highlightStyle : {
                    a : Math.round(effectOption.r / 2),
                    b : Math.round(effectOption.r - effectOption.r / 6),
                    brushType : 'fill',
                    color : effectOption.colorWhirl
                }
            });
            var circleIn = new CircleShape({
                highlightStyle : {
                    r : Math.round(effectOption.r / 6),
                    brushType : 'fill',
                    color : effectOption.colorIn
                }
            });
            var circleOut = new RingShape({
                highlightStyle : {
                    r0 : Math.round(effectOption.r - effectOption.r / 3),
                    r : effectOption.r,
                    brushType : 'fill',
                    color : effectOption.colorOut
                }
            });

            var pos = [ 0, effectOption.x, effectOption.y ];

            droplet.highlightStyle.x
                = circleIn.highlightStyle.x
                = circleOut.highlightStyle.x
                = pos[1];
            droplet.highlightStyle.y
                = circleIn.highlightStyle.y
                = circleOut.highlightStyle.y
                = pos[2];

            return setInterval(
                function() {
                    addShapeHandle(background);
                    addShapeHandle(circleOut);
                    pos[0] -= 0.3;
                    droplet.rotation = pos;
                    addShapeHandle(droplet);
                    addShapeHandle(circleIn);
                    addShapeHandle(textShape);
                    refreshHandle();
                },
                effectOption.timeInterval
            );
        };

        return Whirling;
    }
);
