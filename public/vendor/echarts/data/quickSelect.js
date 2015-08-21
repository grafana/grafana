/**
 * Quick select n-th element in an array.
 *
 * Note: it will change the elements placement in array.
 *
 * @module echarts/data/quickSelect
 * @author Yi Shen(https://github.com/pissang)
 */
define(function (require) {

    function defaultCompareFunc(a, b) {
        return a - b;
    }

    function swapElement(list, idx0, idx1) {
        var tmp = list[idx0];
        list[idx0] = list[idx1];
        list[idx1] = tmp;
    }

    function select(list, left, right, nth, compareFunc) {
        var pivotIdx = left;
        while (right > left) {
            var pivotIdx = Math.round((right + left) / 2);
            var pivotValue = list[pivotIdx];
            // Swap pivot to the end
            swapElement(list, pivotIdx, right);
            pivotIdx = left;
            for (var i = left; i <= right - 1; i++) {
                if (compareFunc(pivotValue, list[i]) >= 0) {
                    swapElement(list, i, pivotIdx);
                    pivotIdx++;
                }
            }
            swapElement(list, right, pivotIdx);

            if (pivotIdx === nth) {
                return pivotIdx;
            } else if (pivotIdx < nth) {
                left = pivotIdx + 1;
            } else {
                right = pivotIdx - 1;
            }
        }
        // Left == right
        return left;
    }

    /**
     * @alias module:echarts/data/quickSelect
     * @param {Array} list
     * @param {number} [left]
     * @param {number} [right]
     * @param {number} nth
     * @param {Function} [compareFunc]
     * @example
     *     var quickSelect = require('echarts/data/quickSelect');
     *     var list = [5, 2, 1, 4, 3]
     *     quickSelect(list, 3);
     *     quickSelect(list, 0, 3, 1, function (a, b) {return a - b});
     *
     * @return {number}
     */
    function quickSelect(list, left, right, nth, compareFunc) {
        if (arguments.length <= 3) {
            nth = left;
            if (arguments.length == 2) {
                compareFunc = defaultCompareFunc;
            } else {
                compareFunc = right;
            }
            left = 0;
            right = list.length - 1;
        }
        return select(list, left, right, nth, compareFunc);
    }
    
    return quickSelect;
});