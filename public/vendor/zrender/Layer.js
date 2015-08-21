/**
 * @module zrender/Layer
 * @author pissang(https://www.github.com/pissang)
 */
define(function (require) {

    var Transformable = require('./mixin/Transformable');
    var util = require('./tool/util');
    var vmlCanvasManager = window['G_vmlCanvasManager'];
    var config = require('./config');

    function returnFalse() {
        return false;
    }

    /**
     * 创建dom
     * 
     * @inner
     * @param {string} id dom id 待用
     * @param {string} type dom type，such as canvas, div etc.
     * @param {Painter} painter painter instance
     */
    function createDom(id, type, painter) {
        var newDom = document.createElement(type);
        var width = painter.getWidth();
        var height = painter.getHeight();

        // 没append呢，请原谅我这样写，清晰~
        newDom.style.position = 'absolute';
        newDom.style.left = 0;
        newDom.style.top = 0;
        newDom.style.width = width + 'px';
        newDom.style.height = height + 'px';
        newDom.width = width * config.devicePixelRatio;
        newDom.height = height * config.devicePixelRatio;

        // id不作为索引用，避免可能造成的重名，定义为私有属性
        newDom.setAttribute('data-zr-dom-id', id);
        return newDom;
    }

    /**
     * @alias module:zrender/Layer
     * @constructor
     * @extends module:zrender/mixin/Transformable
     * @param {string} id
     * @param {module:zrender/Painter} painter
     */
    var Layer = function(id, painter) {

        this.id = id;

        this.dom = createDom(id, 'canvas', painter);
        this.dom.onselectstart = returnFalse; // 避免页面选中的尴尬
        this.dom.style['-webkit-user-select'] = 'none';
        this.dom.style['user-select'] = 'none';
        this.dom.style['-webkit-touch-callout'] = 'none';
        this.dom.style['-webkit-tap-highlight-color'] = 'rgba(0,0,0,0)';

        this.dom.className = config.elementClassName;

        vmlCanvasManager && vmlCanvasManager.initElement(this.dom);

        this.domBack = null;
        this.ctxBack = null;

        this.painter = painter;

        this.unusedCount = 0;

        this.config = null;

        this.dirty = true;

        this.elCount = 0;

        // Configs
        /**
         * 每次清空画布的颜色
         * @type {string}
         * @default 0
         */
        this.clearColor = 0;
        /**
         * 是否开启动态模糊
         * @type {boolean}
         * @default false
         */
        this.motionBlur = false;
        /**
         * 在开启动态模糊的时候使用，与上一帧混合的alpha值，值越大尾迹越明显
         * @type {number}
         * @default 0.7
         */
        this.lastFrameAlpha = 0.7;
        /**
         * 层是否支持鼠标平移操作
         * @type {boolean}
         * @default false
         */
        this.zoomable = false;
        /**
         * 层是否支持鼠标缩放操作
         * @type {boolean}
         * @default false
         */
        this.panable = false;

        this.maxZoom = Infinity;
        this.minZoom = 0;

        Transformable.call(this);
    };

    Layer.prototype.initContext = function () {
        this.ctx = this.dom.getContext('2d');

        var dpr = config.devicePixelRatio;
        if (dpr != 1) { 
            this.ctx.scale(dpr, dpr);
        }
    };

    Layer.prototype.createBackBuffer = function () {
        if (vmlCanvasManager) { // IE 8- should not support back buffer
            return;
        }
        this.domBack = createDom('back-' + this.id, 'canvas', this.painter);
        this.ctxBack = this.domBack.getContext('2d');

        var dpr = config.devicePixelRatio;

        if (dpr != 1) { 
            this.ctxBack.scale(dpr, dpr);
        }
    };

    /**
     * @param  {number} width
     * @param  {number} height
     */
    Layer.prototype.resize = function (width, height) {
        var dpr = config.devicePixelRatio;

        this.dom.style.width = width + 'px';
        this.dom.style.height = height + 'px';

        this.dom.setAttribute('width', width * dpr);
        this.dom.setAttribute('height', height * dpr);

        if (dpr != 1) { 
            this.ctx.scale(dpr, dpr);
        }

        if (this.domBack) {
            this.domBack.setAttribute('width', width * dpr);
            this.domBack.setAttribute('height', height * dpr);

            if (dpr != 1) { 
                this.ctxBack.scale(dpr, dpr);
            }
        }
    };

    /**
     * 清空该层画布
     */
    Layer.prototype.clear = function () {
        var dom = this.dom;
        var ctx = this.ctx;
        var width = dom.width;
        var height = dom.height;

        var haveClearColor = this.clearColor && !vmlCanvasManager;
        var haveMotionBLur = this.motionBlur && !vmlCanvasManager;
        var lastFrameAlpha = this.lastFrameAlpha;
        
        var dpr = config.devicePixelRatio;

        if (haveMotionBLur) {
            if (!this.domBack) {
                this.createBackBuffer();
            } 

            this.ctxBack.globalCompositeOperation = 'copy';
            this.ctxBack.drawImage(
                dom, 0, 0,
                width / dpr,
                height / dpr
            );
        }

        ctx.clearRect(0, 0, width / dpr, height / dpr);
        if (haveClearColor) {
            ctx.save();
            ctx.fillStyle = this.clearColor;
            ctx.fillRect(0, 0, width / dpr, height / dpr);
            ctx.restore();
        }

        if (haveMotionBLur) {
            var domBack = this.domBack;
            ctx.save();
            ctx.globalAlpha = lastFrameAlpha;
            ctx.drawImage(domBack, 0, 0, width / dpr, height / dpr);
            ctx.restore();
        }
    };

    util.merge(Layer.prototype, Transformable.prototype);

    return Layer;
});