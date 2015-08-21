/**
 * echarts层级查找方法
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function(require) {
    var zrUtil = require('zrender/tool/util');
    
    /**
     * 获取嵌套选项的基础方法
     * 返回optionTarget中位于optionLocation上的值，如果没有定义，则返回undefined
     */
    function query(optionTarget, optionLocation) {
        if (typeof optionTarget == 'undefined') {
            return;
        }

        if (!optionLocation) {
            return optionTarget;
        }

        optionLocation = optionLocation.split('.');
        var length = optionLocation.length;
        var curIdx = 0;
        while (curIdx < length) {
            optionTarget = optionTarget[optionLocation[curIdx]];
            if (typeof optionTarget == 'undefined') {
                return;
            }
            curIdx++;
        }

        return optionTarget;
    }
        
    /**
     * 获取多级控制嵌套属性的基础方法
     * 返回ctrList中优先级最高（最靠前）的非undefined属性，ctrList中均无定义则返回undefined
     */
    function deepQuery(ctrList, optionLocation) {
        var finalOption;
        for (var i = 0, l = ctrList.length; i < l; i++) {
            finalOption = query(ctrList[i], optionLocation);
            if (typeof finalOption != 'undefined') {
                return finalOption;
            }
        }
    }
    
    /**
     * 获取多级控制嵌套属性的基础方法
     * 根据ctrList中优先级合并产出目标属性
     */
    function deepMerge(ctrList, optionLocation) {
        var finalOption;
        var len = ctrList.length;
        while (len--) {
            var tempOption = query(ctrList[len], optionLocation);
            if (typeof tempOption != 'undefined') {
                if (typeof finalOption == 'undefined') {
                    finalOption = zrUtil.clone(tempOption);
                }
                else {
                    zrUtil.merge(
                        finalOption, tempOption, true
                    );
                }
            }
        }
        
        return finalOption;
    }
    
    return {
        query : query,
        deepQuery : deepQuery,
        deepMerge : deepMerge
    };
});
