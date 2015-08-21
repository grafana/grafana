/**
 * @file defines echarts Heatmap Chart
 * @author Ovilia (me@zhangwenli.com)
 * Inspired by https://github.com/mourner/simpleheat
 *
 * @module
 */
define(function (require) {
    var defaultOptions = {
        blurSize: 30,

        // gradientColors is either shaped of ['blue', 'cyan', 'lime', 'yellow', 'red']
        // or [{
        //    offset: 0.2,
        //    color: 'blue'
        // }, {
        //    offset 0.8,
        //    color: 'cyan'
        // }]
        gradientColors: ['blue', 'cyan', 'lime', 'yellow', 'red'],
        minAlpha: 0.05,
        valueScale: 1,
        opacity: 1
    };

    var BRUSH_SIZE = 20;
    var GRADIENT_LEVELS = 256;

    /**
     * Heatmap Chart
     *
     * @class
     * @param {Object} opt options
     */
    function Heatmap(opt) {
        this.option = opt;
        if (opt) {
            for (var i in defaultOptions) {
                if (opt[i] !== undefined) {
                    this.option[i] = opt[i];
                } else {
                    this.option[i] = defaultOptions[i];
                }
            }
        } else {
            this.option = defaultOptions;
        }
    }

    Heatmap.prototype = {
        /**
         * Renders Heatmap and returns the rendered canvas
         * @param {Array} [x, y, value] array of data
         * @param {number} canvas width
         * @param {number} canvas height
         * @return {Object} rendered canvas
         */
        getCanvas: function(data, width, height) {
            var brush = this._getBrush();
            var gradient = this._getGradient();
            var r = BRUSH_SIZE + this.option.blurSize;

            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');

            var len = data.length;
            for (var i = 0; i < len; ++i) {
                var p = data[i];
                var x = p[0];
                var y = p[1];
                var value = p[2];

                // calculate alpha using value
                var alpha = Math.min(1, Math.max(value * this.option.valueScale
                    || this.option.minAlpha, this.option.minAlpha));

                // draw with the circle brush with alpha
                ctx.globalAlpha = alpha;
                ctx.drawImage(brush, x - r, y - r);
            }

            // colorize the canvas using alpha value and set with gradient
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var pixels = imageData.data;
            var len = pixels.length / 4;
            while(len--) {
                var id = len * 4 + 3;
                var alpha = pixels[id] / 256;
                var colorOffset = Math.floor(alpha * (GRADIENT_LEVELS - 1));
                pixels[id - 3] = gradient[colorOffset * 4];     // red
                pixels[id - 2] = gradient[colorOffset * 4 + 1]; // green
                pixels[id - 1] = gradient[colorOffset * 4 + 2]; // blue
                pixels[id] *= this.option.opacity;              // alpha
            }
            ctx.putImageData(imageData, 0, 0);

            return canvas;
        },

        /**
         * get canvas of a black circle brush used for canvas to draw later
         * @private
         * @returns {Object} circle brush canvas
         */
        _getBrush: function() {
            if (!this._brushCanvas) {
                this._brushCanvas = document.createElement('canvas');

                // set brush size
                var r = BRUSH_SIZE + this.option.blurSize;
                var d = r * 2;
                this._brushCanvas.width = d;
                this._brushCanvas.height = d;

                var ctx = this._brushCanvas.getContext('2d');

                // in order to render shadow without the distinct circle,
                // draw the distinct circle in an invisible place,
                // and use shadowOffset to draw shadow in the center of the canvas
                ctx.shadowOffsetX = d;
                ctx.shadowBlur = this.option.blurSize;
                // draw the shadow in black, and use alpha and shadow blur to generate
                // color in color map
                ctx.shadowColor = 'black';

                // draw circle in the left to the canvas
                ctx.beginPath();
                ctx.arc(-r, r, BRUSH_SIZE, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fill();
            }
            return this._brushCanvas;
        },

        /**
         * get gradient color map
         * @private
         * @returns {array} gradient color pixels
         */
        _getGradient: function() {
            if (!this._gradientPixels) {
                var levels = GRADIENT_LEVELS;
                var canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = levels;
                var ctx = canvas.getContext('2d');
                
                // add color to gradient stops
                var gradient = ctx.createLinearGradient(0, 0, 0, levels);
                var len = this.option.gradientColors.length;
                for (var i = 0; i < len; ++i) {
                    if (typeof this.option.gradientColors[i] === 'string') {
                        gradient.addColorStop((i + 1) / len,
                            this.option.gradientColors[i]);
                    } else {
                        gradient.addColorStop(this.option.gradientColors[i].offset,
                            this.option.gradientColors[i].color);
                    }
                }

                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 1, levels);
                this._gradientPixels = ctx.getImageData(0, 0, 1, levels).data;
            }
            return this._gradientPixels;
        }
    };

    return Heatmap;
});
