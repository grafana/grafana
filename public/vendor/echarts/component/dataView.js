/**
 * echarts组件：提示框
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function (require) {
    var Base = require('./base');

    var ecConfig = require('../config');
    var zrUtil = require('zrender/tool/util');
    
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {Object} option 提示框参数
     * @param {HtmlElement} dom 目标对象
     */
    function DataView(ecTheme, messageCenter, zr, option, myChart) {
        Base.call(this, ecTheme, messageCenter, zr, option, myChart);

        this.dom = myChart.dom;
        
        // dataview dom & css
        this._tDom = document.createElement('div');
        this._textArea = document.createElement('textArea');
        this._buttonRefresh = document.createElement('button');
        // 高级浏览器默认type为submit
        // 如果图表出现在form表单时，点击button后会提交表单
        // 设置为button，防止点击button后提交表单
        this._buttonRefresh.setAttribute('type', 'button');
        this._buttonClose = document.createElement('button');
        this._buttonClose.setAttribute('type', 'button');
        this._hasShow = false;

        // 缓存一些高宽数据
        this._zrHeight = zr.getHeight();
        this._zrWidth = zr.getWidth();
    
        this._tDom.className = 'echarts-dataview';
        this.hide();
        this.dom.firstChild.appendChild(this._tDom);

        if (window.addEventListener) {
            this._tDom.addEventListener('click', this._stop);
            this._tDom.addEventListener('mousewheel', this._stop);
            this._tDom.addEventListener('mousemove', this._stop);
            this._tDom.addEventListener('mousedown', this._stop);
            this._tDom.addEventListener('mouseup', this._stop);

            // mobile支持
            this._tDom.addEventListener('touchstart', this._stop);
            this._tDom.addEventListener('touchmove', this._stop);
            this._tDom.addEventListener('touchend', this._stop);
        }
        else {
            this._tDom.attachEvent('onclick', this._stop);
            this._tDom.attachEvent('onmousewheel', this._stop);
            this._tDom.attachEvent('onmousemove', this._stop);
            this._tDom.attachEvent('onmousedown', this._stop);
            this._tDom.attachEvent('onmouseup', this._stop);
        }
    }
    
    DataView.prototype = {
        type : ecConfig.COMPONENT_TYPE_DATAVIEW,
        _lang : ['Data View', 'close', 'refresh'],
        // 通用样式
        _gCssText : 'position:absolute;'
                    + 'display:block;'
                    + 'overflow:hidden;'
                    + 'transition:height 0.8s,background-color 1s;'
                    + '-moz-transition:height 0.8s,background-color 1s;'
                    + '-webkit-transition:height 0.8s,background-color 1s;'
                    + '-o-transition:height 0.8s,background-color 1s;'
                    + 'z-index:1;'
                    + 'left:0;'
                    + 'top:0;',
        hide : function () {
            this._sizeCssText = 'width:' + this._zrWidth + 'px;'
                           + 'height:' + 0 + 'px;'
                           + 'background-color:#f0ffff;';
            this._tDom.style.cssText = this._gCssText + this._sizeCssText;
            // 这是个很恶心的事情
            /*
            this.dom.onselectstart = function () {
                return false;
            };
            */
        },

        show : function (newOption) {
            this._hasShow = true;
            var lang = this.query(this.option, 'toolbox.feature.dataView.lang')
                       || this._lang;

            this.option = newOption;

            this._tDom.innerHTML = '<p style="padding:8px 0;margin:0 0 10px 0;'
                              + 'border-bottom:1px solid #eee">'
                              + (lang[0] || this._lang[0])
                              + '</p>';

            var customContent = this.query(
                this.option, 'toolbox.feature.dataView.optionToContent'
            );
            if (typeof customContent != 'function') {
                this._textArea.value = this._optionToContent();
            }
            else {
                // innerHTML the custom optionToContent;
                this._textArea = document.createElement('div');
                this._textArea.innerHTML = customContent(this.option);
            }

            this._textArea.style.cssText =
                'display:block;margin:0 0 8px 0;padding:4px 6px;overflow:auto;'
                + 'width:100%;'
                + 'height:' + (this._zrHeight - 100) + 'px;';

            this._tDom.appendChild(this._textArea);

            this._buttonClose.style.cssText = 'float:right;padding:1px 6px;';
            this._buttonClose.innerHTML = lang[1] || this._lang[1];
            var self = this;
            this._buttonClose.onclick = function (){
                self.hide();
            };
            this._tDom.appendChild(this._buttonClose);

            if (this.query(this.option, 'toolbox.feature.dataView.readOnly')
                === false
            ) {
                this._buttonRefresh.style.cssText =
                    'float:right;margin-right:10px;padding:1px 6px;';
                this._buttonRefresh.innerHTML = lang[2] || this._lang[2];
                this._buttonRefresh.onclick = function (){
                    self._save();
                };
                this._textArea.readOnly = false;
                this._textArea.style.cursor = 'default';
            }
            else {
                this._buttonRefresh.style.cssText =
                    'display:none';
                this._textArea.readOnly = true;
                this._textArea.style.cursor = 'text';
            }
            this._tDom.appendChild(this._buttonRefresh);

            this._sizeCssText = 'width:' + this._zrWidth + 'px;'
                           + 'height:' + this._zrHeight + 'px;'
                           + 'background-color:#fff;';
            this._tDom.style.cssText = this._gCssText + this._sizeCssText;
            // 这是个很恶心的事情
            /*
            this.dom.onselectstart = function () {
                return true;
            };
            */
        },

        _optionToContent : function () {
            var i;
            var j;
            var k;
            var len;
            var data;
            var valueList;
            var axisList = [];
            var content = '';
            if (this.option.xAxis) {
                if (this.option.xAxis instanceof Array) {
                    axisList = this.option.xAxis;
                } else {
                    axisList = [this.option.xAxis];
                }
                for (i = 0, len = axisList.length; i < len; i++) {
                    // 横纵默认为类目
                    if ((axisList[i].type || 'category') == 'category') {
                        valueList = [];
                        for (j = 0, k = axisList[i].data.length; j < k; j++) {
                            valueList.push(this.getDataFromOption(axisList[i].data[j]));
                        }
                        content += valueList.join(', ') + '\n\n';
                    }
                }
            }

            if (this.option.yAxis) {
                if (this.option.yAxis instanceof Array) {
                    axisList = this.option.yAxis;
                } else {
                    axisList = [this.option.yAxis];
                }
                for (i = 0, len = axisList.length; i < len; i++) {
                    if (axisList[i].type  == 'category') {
                        valueList = [];
                        for (j = 0, k = axisList[i].data.length; j < k; j++) {
                            valueList.push(this.getDataFromOption(axisList[i].data[j]));
                        }
                        content += valueList.join(', ') + '\n\n';
                    }
                }
            }

            var series = this.option.series;
            var itemName;
            for (i = 0, len = series.length; i < len; i++) {
                valueList = [];
                for (j = 0, k = series[i].data.length; j < k; j++) {
                    data = series[i].data[j];
                    if (series[i].type == ecConfig.CHART_TYPE_PIE
                        || series[i].type == ecConfig.CHART_TYPE_MAP
                    ) {
                        itemName = (data.name || '-') + ':';
                    }
                    else {
                        itemName = '';
                    }
                    
                    if (series[i].type == ecConfig.CHART_TYPE_SCATTER) {
                        data = this.getDataFromOption(data).join(', ');
                    }
                    valueList.push(itemName + this.getDataFromOption(data));
                }
                content += (series[i].name || '-') + ' : \n';
                content += valueList.join(
                    series[i].type == ecConfig.CHART_TYPE_SCATTER ? '\n': ', '
                );
                content += '\n\n';
            }

            return content;
        },

        _save : function () {
            var customContent = this.query(
                this.option, 'toolbox.feature.dataView.contentToOption'
            );
            if (typeof customContent != 'function') {
                var text = this._textArea.value.split('\n');
                var content = [];
                for (var i = 0, l = text.length; i < l; i++) {
                    text[i] = this._trim(text[i]);
                    if (text[i] !== '') {
                        content.push(text[i]);
                    }
                }
                this._contentToOption(content);
            }
            else {
                // return the textArea dom for custom contentToOption
                customContent(this._textArea, this.option);
            }

            this.hide();
            
            var self = this;
            setTimeout(
                function (){
                    self.messageCenter && self.messageCenter.dispatch(
                        ecConfig.EVENT.DATA_VIEW_CHANGED,
                        null,
                        {option : self.option},
                        self.myChart
                    );
                },
                // 有动画，所以高级浏览器时间更长点
                self.canvasSupported ? 800 : 100
            );
        },

        _contentToOption : function (content) {
            var i;
            var j;
            var k;
            var len;
            var data;
            var axisList = [];

            var contentIdx = 0;
            var contentValueList;
            var value;

            if (this.option.xAxis) {
                if (this.option.xAxis instanceof Array) {
                    axisList = this.option.xAxis;
                } else {
                    axisList = [this.option.xAxis];
                }
                for (i = 0, len = axisList.length; i < len; i++) {
                    // 横纵默认为类目
                    if ((axisList[i].type || 'category') == 'category'
                    ) {
                        contentValueList = content[contentIdx].split(',');
                        for (j = 0, k = axisList[i].data.length; j < k; j++) {
                            value = this._trim(contentValueList[j] || '');
                            data = axisList[i].data[j];
                            if (typeof axisList[i].data[j].value != 'undefined'
                            ) {
                                axisList[i].data[j].value = value;
                            }
                            else {
                                axisList[i].data[j] = value;
                            }
                        }
                        contentIdx++;
                    }
                }
            }

            if (this.option.yAxis) {
                if (this.option.yAxis instanceof Array) {
                    axisList = this.option.yAxis;
                } else {
                    axisList = [this.option.yAxis];
                }
                for (i = 0, len = axisList.length; i < len; i++) {
                    if (axisList[i].type  == 'category') {
                        contentValueList = content[contentIdx].split(',');
                        for (j = 0, k = axisList[i].data.length; j < k; j++) {
                            value = this._trim(contentValueList[j] || '');
                            data = axisList[i].data[j];
                            if (typeof axisList[i].data[j].value != 'undefined'
                            ) {
                                axisList[i].data[j].value = value;
                            }
                            else {
                                axisList[i].data[j] = value;
                            }
                        }
                        contentIdx++;
                    }
                }
            }

            var series = this.option.series;
            for (i = 0, len = series.length; i < len; i++) {
                contentIdx++;
                if (series[i].type == ecConfig.CHART_TYPE_SCATTER) {
                    for (var j = 0, k = series[i].data.length; j < k; j++) {
                        contentValueList = content[contentIdx];
                        value = contentValueList.replace(' ','').split(',');
                        if (typeof series[i].data[j].value != 'undefined'
                        ) {
                            series[i].data[j].value = value;
                        }
                        else {
                            series[i].data[j] = value;
                        }
                        contentIdx++;
                    }
                }
                else {
                    contentValueList = content[contentIdx].split(',');
                    for (var j = 0, k = series[i].data.length; j < k; j++) {
                        value = (contentValueList[j] || '').replace(/.*:/,'');
                        value = this._trim(value);
                        value = (value != '-' && value !== '')
                                ? (value - 0)
                                : '-';
                        if (typeof series[i].data[j].value != 'undefined'
                        ) {
                            series[i].data[j].value = value;
                        }
                        else {
                            series[i].data[j] = value;
                        }
                    }
                    contentIdx++;
                }
            }
        },

        _trim : function (str){
            var trimer = new RegExp(
                '(^[\\s\\t\\xa0\\u3000]+)|([\\u3000\\xa0\\s\\t]+\x24)', 'g'
            );
            return str.replace(trimer, '');
        },

        // 阻塞zrender事件
        _stop : function (e){
            e = e || window.event;
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            else {
                e.cancelBubble = true;
            }
        },

        /**
         * zrender事件响应：窗口大小改变
         */
        resize : function () {
            this._zrHeight = this.zr.getHeight();
            this._zrWidth = this.zr.getWidth();
            if (this._tDom.offsetHeight > 10) {
                this._sizeCssText = 'width:' + this._zrWidth + 'px;'
                               + 'height:' + this._zrHeight + 'px;'
                               + 'background-color:#fff;';
                this._tDom.style.cssText = this._gCssText + this._sizeCssText;
                this._textArea.style.cssText = 'display:block;margin:0 0 8px 0;'
                                        + 'padding:4px 6px;overflow:auto;'
                                        + 'width:100%;'
                                        + 'height:' + (this._zrHeight - 100) + 'px;';
            }
        },

        /**
         * 释放后实例不可用，重载基类方法
         */
        dispose : function () {
            if (window.removeEventListener) {
                this._tDom.removeEventListener('click', this._stop);
                this._tDom.removeEventListener('mousewheel', this._stop);
                this._tDom.removeEventListener('mousemove', this._stop);
                this._tDom.removeEventListener('mousedown', this._stop);
                this._tDom.removeEventListener('mouseup', this._stop);

                // mobile支持
                this._tDom.removeEventListener('touchstart', this._stop);
                this._tDom.removeEventListener('touchmove', this._stop);
                this._tDom.removeEventListener('touchend', this._stop);
            }
            else {
                this._tDom.detachEvent('onclick', this._stop);
                this._tDom.detachEvent('onmousewheel', this._stop);
                this._tDom.detachEvent('onmousemove', this._stop);
                this._tDom.detachEvent('onmousedown', this._stop);
                this._tDom.detachEvent('onmouseup', this._stop);
            }

            this._buttonRefresh.onclick = null;
            this._buttonClose.onclick = null;

            if (this._hasShow) {
                this._tDom.removeChild(this._textArea);
                this._tDom.removeChild(this._buttonRefresh);
                this._tDom.removeChild(this._buttonClose);
            }

            this._textArea = null;
            this._buttonRefresh = null;
            this._buttonClose = null;

            this.dom.firstChild.removeChild(this._tDom);
            this._tDom = null;
        }
    };
    
    zrUtil.inherits(DataView, Base);
    
    require('../component').define('dataView', DataView);
    
    return DataView;
});
