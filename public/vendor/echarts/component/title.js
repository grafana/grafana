/**
 * echarts组件：图表标题
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var Base = require('./base');
    
    // 图形依赖
    var TextShape = require('zrender/shape/Text');
    var RectangleShape = require('zrender/shape/Rectangle');
    
    var ecConfig = require('../config');
    // 图表标题
    ecConfig.title = {
        zlevel: 0,                  // 一级层叠
        z: 6,                       // 二级层叠
        show: true,
        text: '',
        // link: null,             // 超链接跳转
        // target: null,           // 仅支持self | blank
        subtext: '',
        // sublink: null,          // 超链接跳转
        // subtarget: null,        // 仅支持self | blank
        x: 'left',                 // 水平安放位置，默认为左对齐，可选为：
                                   // 'center' ¦ 'left' ¦ 'right'
                                   // ¦ {number}（x坐标，单位px）
        y: 'top',                  // 垂直安放位置，默认为全图顶端，可选为：
                                   // 'top' ¦ 'bottom' ¦ 'center'
                                   // ¦ {number}（y坐标，单位px）
        //textAlign: null          // 水平对齐方式，默认根据x设置自动调整
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: '#ccc',       // 标题边框颜色
        borderWidth: 0,            // 标题边框线宽，单位px，默认为0（无边框）
        padding: 5,                // 标题内边距，单位px，默认各方向内边距为5，
                                   // 接受数组分别设定上右下左边距，同css
        itemGap: 5,                // 主副标题纵向间隔，单位px，默认为10，
        textStyle: {
            fontSize: 18,
            fontWeight: 'bolder',
            color: '#333'          // 主标题文字颜色
        },
        subtextStyle: {
            color: '#aaa'          // 副标题文字颜色
        }
    };
    
    var zrUtil = require('zrender/tool/util');
    var zrArea = require('zrender/tool/area');
    var zrColor = require('zrender/tool/color');
    
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 图表参数
     */
    function Title(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);
        
        this.refresh(option);
    }
    
    Title.prototype = {
        type: ecConfig.COMPONENT_TYPE_TITLE,
        _buildShape: function () {
            if (!this.titleOption.show) {
                return;
            }
            // 标题元素组的位置参数，通过计算所得x, y, width, height
            this._itemGroupLocation = this._getItemGroupLocation();

            this._buildBackground();
            this._buildItem();

            for (var i = 0, l = this.shapeList.length; i < l; i++) {
                this.zr.addShape(this.shapeList[i]);
            }
        },

        /**
         * 构建所有标题元素
         */
        _buildItem: function () {
            var text = this.titleOption.text;
            var link = this.titleOption.link;
            var target = this.titleOption.target;
            var subtext = this.titleOption.subtext;
            var sublink = this.titleOption.sublink;
            var subtarget = this.titleOption.subtarget;
            var font = this.getFont(this.titleOption.textStyle);
            var subfont = this.getFont(this.titleOption.subtextStyle);
            
            var x = this._itemGroupLocation.x;
            var y = this._itemGroupLocation.y;
            var width = this._itemGroupLocation.width;
            var height = this._itemGroupLocation.height;
            
            var textShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    y: y,
                    color: this.titleOption.textStyle.color,
                    text: text,
                    textFont: font,
                    textBaseline: 'top'
                },
                highlightStyle: {
                    color: zrColor.lift(this.titleOption.textStyle.color, 1),
                    brushType: 'fill'
                },
                hoverable: false
            };
            if (link) {
                textShape.hoverable = true;
                textShape.clickable = true;
                textShape.onclick = function (){
                    if (!target || target != 'self') {
                        window.open(link);
                    }
                    else {
                        window.location = link;
                    }
                };
            }
            
            var subtextShape = {
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                style: {
                    y: y + height,
                    color: this.titleOption.subtextStyle.color,
                    text: subtext,
                    textFont: subfont,
                    textBaseline: 'bottom'
                },
                highlightStyle: {
                    color: zrColor.lift(this.titleOption.subtextStyle.color, 1),
                    brushType: 'fill'
                },
                hoverable: false
            };
            if (sublink) {
                subtextShape.hoverable = true;
                subtextShape.clickable = true;
                subtextShape.onclick = function (){
                    if (!subtarget || subtarget != 'self') {
                        window.open(sublink);
                    }
                    else {
                        window.location = sublink;
                    }
                };
            }

            switch (this.titleOption.x) {
                case 'center' :
                    textShape.style.x = subtextShape.style.x = x + width / 2;
                    textShape.style.textAlign = subtextShape.style.textAlign 
                                              = 'center';
                    break;
                case 'left' :
                    textShape.style.x = subtextShape.style.x = x;
                    textShape.style.textAlign = subtextShape.style.textAlign 
                                              = 'left';
                    break;
                case 'right' :
                    textShape.style.x = subtextShape.style.x = x + width;
                    textShape.style.textAlign = subtextShape.style.textAlign 
                                              = 'right';
                    break;
                default :
                    x = this.titleOption.x - 0;
                    x = isNaN(x) ? 0 : x;
                    textShape.style.x = subtextShape.style.x = x;
                    break;
            }
            
            if (this.titleOption.textAlign) {
                textShape.style.textAlign = subtextShape.style.textAlign 
                                          = this.titleOption.textAlign;
            }

            this.shapeList.push(new TextShape(textShape));
            subtext !== '' && this.shapeList.push(new TextShape(subtextShape));
        },

        _buildBackground: function () {
            var padding = this.reformCssArray(this.titleOption.padding);

            this.shapeList.push(new RectangleShape({
                zlevel: this.getZlevelBase(),
                z: this.getZBase(),
                hoverable :false,
                style: {
                    x: this._itemGroupLocation.x - padding[3],
                    y: this._itemGroupLocation.y - padding[0],
                    width: this._itemGroupLocation.width + padding[3] + padding[1],
                    height: this._itemGroupLocation.height + padding[0] + padding[2],
                    brushType: this.titleOption.borderWidth === 0 ? 'fill' : 'both',
                    color: this.titleOption.backgroundColor,
                    strokeColor: this.titleOption.borderColor,
                    lineWidth: this.titleOption.borderWidth
                }
            }));
        },

        /**
         * 根据选项计算标题实体的位置坐标
         */
        _getItemGroupLocation: function () {
            var padding = this.reformCssArray(this.titleOption.padding);
            var text = this.titleOption.text;
            var subtext = this.titleOption.subtext;
            var font = this.getFont(this.titleOption.textStyle);
            var subfont = this.getFont(this.titleOption.subtextStyle);
            
            var totalWidth = Math.max(
                    zrArea.getTextWidth(text, font),
                    zrArea.getTextWidth(subtext, subfont)
                );
            var totalHeight = zrArea.getTextHeight(text, font)
                              + (subtext === ''
                                 ? 0
                                 : (this.titleOption.itemGap
                                    + zrArea.getTextHeight(subtext, subfont))
                                );

            var x;
            var zrWidth = this.zr.getWidth();
            switch (this.titleOption.x) {
                case 'center' :
                    x = Math.floor((zrWidth - totalWidth) / 2);
                    break;
                case 'left' :
                    x = padding[3] + this.titleOption.borderWidth;
                    break;
                case 'right' :
                    x = zrWidth
                        - totalWidth
                        - padding[1]
                        - this.titleOption.borderWidth;
                    break;
                default :
                    x = this.titleOption.x - 0;
                    x = isNaN(x) ? 0 : x;
                    break;
            }

            var y;
            var zrHeight = this.zr.getHeight();
            switch (this.titleOption.y) {
                case 'top' :
                    y = padding[0] + this.titleOption.borderWidth;
                    break;
                case 'bottom' :
                    y = zrHeight
                        - totalHeight
                        - padding[2]
                        - this.titleOption.borderWidth;
                    break;
                case 'center' :
                    y = Math.floor((zrHeight - totalHeight) / 2);
                    break;
                default :
                    y = this.titleOption.y - 0;
                    y = isNaN(y) ? 0 : y;
                    break;
            }

            return {
                x: x,
                y: y,
                width: totalWidth,
                height: totalHeight
            };
        },
        
        /**
         * 刷新
         */
        refresh: function (newOption) {
            if (newOption) {
                this.option = newOption;

                this.option.title = this.reformOption(this.option.title);
                this.titleOption = this.option.title;
                this.titleOption.textStyle = this.getTextStyle(
                    this.titleOption.textStyle
                );
                this.titleOption.subtextStyle = this.getTextStyle(
                    this.titleOption.subtextStyle
                );
            }
            
            this.clear();
            this._buildShape();
        }
    };
    
    zrUtil.inherits(Title, Base);
    
    require('../component').define('title', Title);
    
    return Title;
});


