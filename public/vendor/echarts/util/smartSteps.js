
/**
 * echarts 值轴分段刻度计算方法
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @author xieshiwei (谢世威, i6ma@i6ma.com)
 *
 */


/**
 * 最值、跨度、步长取近似值
 * 注意：不适用于高精度需求，或者很多位有效数字的情况！！！
 * @function    smartSteps
 * @param       {Number}    min             最小值
 * @param       {Number}    max             最大值
 * @param       {Number}    [section]       段数只能是 [0, 99] 的整数，段数为 0 或者不指定段数时，将自动调整段数
 * @param       {Object}    [opts]          其它扩展参数
 * @param       {Array}     opts.steps      自定义步长备选值，如 [10, 12, 15, 20, 25, 30, 40, 50, 60, 80] ，但必须 => [10, 99]
 * @return      {Object}    {min: 新最小值, max: 新最大值, secs: 分段数, step: 每段长, fix: 小数保留位数, pnts: [分段结果]}
 */
define(function() {



var mySteps     = [10, 20, 25, 50];
var mySections  = [4, 5, 6];

var custOpts;
var custSteps;
var custSecs;
var minLocked;
var maxLocked;

var MT          = Math;
var MATH_ROUND  = MT.round;
var MATH_FLOOR  = MT.floor;
var MATH_CEIL   = MT.ceil;
var MATH_ABS    = MT.abs;


function MATH_LOG(n) {return MT.log(MATH_ABS(n)) / MT.LN10;}
function MATH_POW(n) {return MT.pow(10, n);}
function MATH_ISINT(n) {return n === MATH_FLOOR(n);}


function smartSteps(min, max, section, opts) {
    // 拿公共变量来接收 opts.steps 这个参数，就不用带着参数层层传递了，注意在函数的最终出口处释放这个值
    custOpts    = opts || {};
    custSteps   = custOpts.steps || mySteps;
    custSecs    = custOpts.secs || mySections;
    section     = MATH_ROUND(+section || 0) % 99;           // 段数限定在 [0, 99] ，0 则自适应
    min         = +min || 0;
    max         = +max || 0;
    minLocked   = maxLocked = 0;
    if ('min' in custOpts) {
        min     = +custOpts.min || 0;
        minLocked = 1;
    }
    if ('max' in custOpts) {
        max     = +custOpts.max || 0;
        maxLocked = 1;
    }
    if (min > max) {max = [min, min = max][0];}             // 最值交换
    var span    = max - min;
    if (minLocked && maxLocked) {
        return bothLocked(min, max, section);               // 两个最值同时被锁定，注意差值为 0 的情况
    }
    if (span < (section || 5)) {                            // 跨度值小于要分的段数，步长将会小于 1
        if (MATH_ISINT(min) && MATH_ISINT(max)) {           // 步长小于 1 同时两个最值都是整数，特别处理
            return forInteger(min, max, section);           // 也要考虑差值为 0 的情况
        }
        else if (span === 0) {                              // 非整数且跨度为 0 的情况
            return forSpan0(min, max, section);
        }
    }
    return coreCalc(min, max, section);                     // 非特殊情况的计算，须确保 min < max
}



/**
 * 构造返回值，处理小数精度等问题
 * @param   {Number}    newMin      最小值
 * @param   {Number}    newMax      最大值
 * @param   {Number}    section     分段数
 * @param   {Number}    [expon]     计算量级
 * @return  {Object}                同 smartSteps
 */
function makeResult(newMin, newMax, section, expon) {
    expon       = expon || 0;                               // 这是中间计算量级，受步长增长、特别是最值锁定的影响，可能会小于基准量级，因为整数部分被过度放大
    var expStep = expNum((newMax - newMin) / section, -1);
    var expMin  = expNum(newMin, -1, 1);                    // 锁定的最值有效数位可能很多，需要全精度保留
    var expMax  = expNum(newMax, -1);
    var minExp  = MT.min(expStep.e, expMin.e, expMax.e);    // 这个值实际上就是各值整数部分尾部多余的 0 的个数
    if (expMin.c === 0) {                                   // 0 可以有任意多个尾0
        minExp  = MT.min(expStep.e, expMax.e);
    } else if (expMax.c === 0) {
        minExp  = MT.min(expStep.e, expMin.e);
    }
    expFixTo(expStep, {c: 0, e: minExp});
    expFixTo(expMin, expStep, 1);
    expFixTo(expMax, expStep);
    expon      += minExp;                                   // 最终的基准量级，在这个量级下，各值刚好能表示成整数
    newMin      = expMin.c;
    newMax      = expMax.c;
    var step    = (newMax - newMin) / section;
    var zoom    = MATH_POW(expon);
    var fixTo   = 0;
    var points  = [];
    for (var i  = section + 1; i--;) {                      // 因为点数比段数多 1
        points[i] = (newMin + step * i) * zoom;             // 如果不涉及小数问题，这里就直接使用数值型
    }
    if (expon   < 0) {
        fixTo   = decimals(zoom);                           // 前面已经去掉了各值尾部多余的 0 ，所以 zoom 的小数位就是最终的 fix 位数
        step    = +(step * zoom).toFixed(fixTo);            // toFixed 处理长尾小数问题，如：0.2 * 0.1 = 0.020000000000000004
        newMin  = +(newMin * zoom).toFixed(fixTo);
        newMax  = +(newMax * zoom).toFixed(fixTo);
        for (var i = points.length; i--;) {
            points[i] = points[i].toFixed(fixTo);           // 为保证小数点对齐，统一转为字符型
            +points[i] === 0 && (points[i] = '0');          // 0.000 不好看
        }
    }
    else {
        newMin *= zoom;
        newMax *= zoom;
        step   *= zoom;
    }
    custSecs    = 0;
    custSteps   = 0;
    custOpts    = 0;
    // 这些公共变量可能持用了对用户参数的引用，这里是函数的最终出口，释放引用

    return {
        min:    newMin,                 // 新最小值
        max:    newMax,                 // 新最大值
        secs:   section,                // 分段数
        step:   step,                   // 每段长
        fix:    fixTo,                  // 小数保留位数，0 则为整数
        exp:    expon,                  // 基准量级，并非原值所在的量级，而是说在这个量级下，各值能表示成整数
        pnts:   points                  // 分段结果，整数都是数值型，小数时为了对齐小数点，都是字符型，但其中 0 不带小数点，即没有 "0.000"
    };
}



/**
 * 量级计数法 表示数值，不适用于很大或者很小的数，0 更不行
 * @param       {Number}    num             原数
 * @param       {Number}    [digit = 2]     精度位数，必须 => [1, 9]
 * @param       {Boolean}   [byFloor = 0]   默认为 0 表示近似值不小于原值，置 1 表示近似值不大于原值
 * @return      {Object}    {c: c, e: e}    c e 都是整数，c * 10 ^ e 即为原值的近似数
 * @description             返回值应该更详细一点：{c: c, e: e, d: d, n: n} ，其中 d 是 c 的位数，n = c * 10 ^ e ，不过目前好像不太有用
 */
function expNum(num, digit, byFloor) {
    digit       = MATH_ROUND(digit % 10) || 2;
    if (digit   < 0) {                                      // 全精度位数
        if (MATH_ISINT(num)) {                              // 整数的全精度位数，要去掉尾 0 ，但 0 也是整数，要专门留一位精度
            digit = ('' + MATH_ABS(num)).replace(/0+$/, '').length || 1;
        }
        else {                                              // 小数的全精度位数，要去掉首 0
            num = num.toFixed(15).replace(/0+$/, '');       // toFixed 处理长尾小数
            digit = num.replace('.', '').replace(/^[-0]+/, '').length;
            num = +num;                                     // '' + 0.0000001 会得到 '1e-7'
        }
    }
    var expon   = MATH_FLOOR(MATH_LOG(num)) - digit + 1;
    var cNum    = +(num * MATH_POW(-expon)).toFixed(15) || 0;   // toFixed 处理长尾小数问题
    cNum        = byFloor ? MATH_FLOOR(cNum) : MATH_CEIL(cNum); // 向上取整可能发生进位，使精度位数增加 1
    !cNum && (expon = 0);
    if (('' + MATH_ABS(cNum)).length > digit) {                 // 整数位数判断，字符串法比对数法快近一倍
        expon  += 1;
        cNum   /= 10;
    }
    return {
        c: cNum,
        e: expon
    };
}


/**
 * 将前者的指数对齐到后者，如果前者量级较小，就是强制加大指数，值误差可能严重放大，甚至值变为 0
 */
function expFixTo(expnum1, expnum2, byFloor) {
    var deltaExp    = expnum2.e - expnum1.e;
    if (deltaExp) {
        expnum1.e  += deltaExp;                             // 指数减小时，只需将整数部分相应放大
        expnum1.c  *= MATH_POW(-deltaExp);                  // 指数增加时，整数部分将缩小，就涉及 floor ceil 取整和变 0 问题
        expnum1.c   = byFloor ? MATH_FLOOR(expnum1.c) : MATH_CEIL(expnum1.c);
    }
}


/**
 * 将两个量级数的指数对齐到较小者
 */
function expFixMin(expnum1, expnum2, byFloor) {
    if (expnum1.e < expnum2.e) {
        expFixTo(expnum2, expnum1, byFloor);
    }
    else {
        expFixTo(expnum1, expnum2, byFloor);
    }
}


/**
 * 基于量级计数法，对原值的整数部分取近似，不适用于负数和 0
 * @param       {Number}    num             原值
 * @param       {Array}     [rounds]        在取近似时，提供预置选项，近似到 rounds 中的某项
 * @return      {Object}    expNum          2 位精度的量级计数法对象，不小于原值
 */
function getCeil(num, rounds) {
    rounds      = rounds || mySteps;
    num         = expNum(num);                              // 2 位精度量级计数法
    var cNum    = num.c;
    var i       = 0;
    while (cNum > rounds[i]) {                              // 在预置的近似数中，找到不小于目标 cNum 的项
        i++;
    }
    if (!rounds[i]) {                                       // 如果没找到合适的预置项，一定是目标值大于全部的预置项
        cNum   /= 10;                                       // 将目标值缩小 10 倍，重找一次定能命中
        num.e  += 1;
        i       = 0;
        while (cNum > rounds[i]) {
            i++;
        }
    }
    num.c       = rounds[i];
    return num;
}




/**
 * 基于量级计数法的计算，必须 min < max
 */
function coreCalc(min, max, section) {
    var step;
    var secs    = section || +custSecs.slice(-1);
    var expStep = getCeil((max - min) / secs, custSteps);   // 这是可能的最小步长，以它的量级作为后续计算的基准量级，以保证整数计算特性
    var expSpan = expNum(max - min);                        // 2 位精度的最值跨度，过高的精度意味着有效数位更多
    var expMin  = expNum(min, -1, 1);                       // 最小值向下近似，以涵盖原最小值
    var expMax  = expNum(max, -1);     // 最大值向上近似，参数 -1 表示保留全精度，因为要注意 min = 10000001, max = 10000002 等情况
    expFixTo(expSpan, expStep);                             // 指数对齐
    expFixTo(expMin, expStep, 1);                           // 经过指数对齐，原最大值、最小值都有可能变为 0
    expFixTo(expMax, expStep);
    if (!section) {
        secs    = look4sections(expMin, expMax);
    }
    else {
        step    = look4step(expMin, expMax, secs);
    }

    // 如果原最值都是整数，尽量让输出值也保持整数，但原最值跨 0 的则不调整
    if (MATH_ISINT(min) && MATH_ISINT(max) && min * max >= 0) {
        if (max - min < secs) {                             // 再次出现跨度小于段数
            return forInteger(min, max, secs);
        }
        secs = tryForInt(min, max, section, expMin, expMax, secs);
    }
    var arrMM   = cross0(min, max, expMin.c, expMax.c);
    expMin.c    = arrMM[0];
    expMax.c    = arrMM[1];
    if (minLocked || maxLocked) {
        singleLocked(min, max, expMin, expMax);
    }
    return makeResult(expMin.c, expMax.c, secs, expMax.e);
}



/**
 * 在预置的可选段数中，找出一个合适的值，让跨度误差尽量小
 */
function look4sections(expMin, expMax) {
    var section;
    var tmpStep, tmpMin, tmpMax;
    var reference   = [];
    for (var i      = custSecs.length; i--;) {              // 逐步减小段数，步长就会渐大
        section     = custSecs[i];
        tmpStep     = getCeil((expMax.c - expMin.c) / section, custSteps);
        tmpStep     = tmpStep.c * MATH_POW(tmpStep.e);      // 步长都用常规整数参与计算
        tmpMin      = MATH_FLOOR(expMin.c / tmpStep) * tmpStep;
        tmpMax      = MATH_CEIL(expMax.c / tmpStep) * tmpStep;
        reference[i] = {
            min:    tmpMin,
            max:    tmpMax,
            step:   tmpStep,
            span:   tmpMax - tmpMin                         // 步长的误差被 段数 成倍放大，可能会给跨度造成更大的误差，使最后的段数大于预置的最大值
        };
    }
    reference.sort(function (a, b) {
        var delta = a.span - b.span;                        // 分段调整之后的跨度，一定不小于原跨度，所以越小越好
        if (delta === 0) {
            delta = a.step - b.step;                        // 跨度相同时，步长小者胜出
        }
        return delta;
    });
    reference   = reference[0];
    section     = reference.span / reference.step;
    expMin.c    = reference.min;
    expMax.c    = reference.max;
    return section < 3 ? section * 2 : section;             // 如果最终步长比最小步长大得多，段数就可能变得很小
}


/**
 * 指定段数，在预置的可选步长中，找出一个合适的值，让 步长 * 段数 积刚好涵盖原最大值与最小值
 */
function look4step(expMin, expMax, secs) {
    var span;
    var tmpMax;
    var tmpMin      = expMax.c;
    var tmpStep     = (expMax.c - expMin.c) / secs - 1;
    while (tmpMin   > expMin.c) {
        tmpStep     = getCeil(tmpStep + 1, custSteps);
        tmpStep     = tmpStep.c * MATH_POW(tmpStep.e);
        span        = tmpStep * secs;
        tmpMax      = MATH_CEIL(expMax.c / tmpStep) * tmpStep;
        tmpMin      = tmpMax - span;                        // 优先保证 max 端的误差最小，试看原 min 值能否被覆盖到
    }
    var deltaMin    = expMin.c - tmpMin;                    // 上面的计算可能会让 min 端的误差更大，下面尝试均衡误差
    var deltaMax    = tmpMax - expMax.c;
    var deltaDelta  = deltaMin - deltaMax;
    if (deltaDelta  > tmpStep * 1.1) {                      // 当 min 端的误差比 max 端大很多时，考虑将 tmpMin tmpMax 同时上移
        deltaDelta  = MATH_ROUND(deltaDelta / tmpStep / 2) * tmpStep;
        tmpMin     += deltaDelta;
        tmpMax     += deltaDelta;
    }
    expMin.c   = tmpMin;
    expMax.c   = tmpMax;
    return tmpStep;
}


/**
 * 原最值都是整数时，尝试让输出也保持整数
 */
function tryForInt(min, max, section, expMin, expMax, secs) {
    var span = expMax.c - expMin.c;
    var step = span / secs * MATH_POW(expMax.e);
    if (!MATH_ISINT(step)) {                                // 原最值都是整数，但计算步长可能出现小数，如 2.5
        step = MATH_FLOOR(step);                            // 步长总是要尽量小，以减小跨度误差，所以 2.5 可能被调整为 2 或者 3
        span = step * secs;
        if (span < max - min) {
            step += 1;
            span = step * secs;
            if (!section && (step * (secs - 1) >= (max - min))) {
                secs -= 1;
                span = step * secs;
            }
        }
        if (span >= max - min) {
            var delta   = span - (max - min);               // 误差均衡
            expMin.c    = MATH_ROUND(min - delta / 2);
            expMax.c    = MATH_ROUND(max + delta / 2);
            expMin.e    = 0;
            expMax.e    = 0;
        }
    }
    return secs;
}




/**
 * 整数情况下，跨度小于段数的处理
 */
function forInteger(min, max, section) {
    section     = section || 5;
    if (minLocked) {
        max     = min + section;                            // min max 没有写错，因为 min locked 所以 max 在 min 上浮动
    }
    else if (maxLocked) {
        min     = max - section;
    }
    else {
        var delta   = section - (max - min);                // 没有端点锁定时，向上下延展跨度
        var newMin  = MATH_ROUND(min - delta / 2);
        var newMax  = MATH_ROUND(max + delta / 2);
        var arrMM   = cross0(min, max, newMin, newMax);     // 避免跨 0
        min         = arrMM[0];
        max         = arrMM[1];
    }
    return makeResult(min, max, section);
}


/**
 * 非整数情况下，跨度为 0 的处理
 */
function forSpan0(min, max, section) {
    section     = section || 5;
    // delta 一定不为 0 ，因为 min === max === 0 的情况会进入 forInteger 分支
    var delta   = MT.min(MATH_ABS(max / section), section) / 2.1;
    if (minLocked) {
        max     = min + delta;                              // min max 没有写错，因为 min locked 所以 max 在 min 上浮动
    }
    else if (maxLocked) {
        min     = max - delta;
    }
    else {                                                  // 以最值为中心，上下各延展一小段
        min     = min - delta;
        max     = max + delta;
    }
    return coreCalc(min, max, section);
}


/**
 * 当原始最值都在 0 的同侧时，让输出也保持在 0 的同侧
 */
function cross0(min, max, newMin, newMax) {
    if (min >= 0 && newMin < 0) {
        newMax -= newMin;
        newMin  = 0;
    }
    else if (max <= 0 && newMax > 0) {
        newMin -= newMax;
        newMax  = 0;
    }
    return [newMin, newMax];
}


/**
 * 取一个数的小数位数
 * @param   {Number}    num         原数值
 * @return  {Number}    decimals    整数则返回 0 ，小数则返回小数点后的位数
 */
function decimals(num) {
    num = (+num).toFixed(15).split('.');                    // String(0.0000001) 会得到 '1e-7'
    return num.pop().replace(/0+$/, '').length;
}






/**
 * 单个最值锁定处理，只是在原计算的基础上，锁定一个，平移另一个
 */
function singleLocked(min, max, emin, emax) {
    if (minLocked) {
        var expMin  = expNum(min, 4, 1);                    // 4 位精度向下近似
        if (emin.e  - expMin.e > 6) {                       // 如果锁定值的量级远小于基准量级，认为锁定失败，强置为 0
            expMin  = {c: 0, e: emin.e};
        }
        expFixMin(emin, expMin);                            // 将指数与量级较小者对齐
        expFixMin(emax, expMin);
        emax.c     += expMin.c - emin.c;                    // 最大值平移
        emin.c      = expMin.c;                             // 最小值锁定
    }
    else if (maxLocked) {
        var expMax  = expNum(max, 4);                       // 4 位精度向上近似
        if (emax.e  - expMax.e > 6) {                       // 如果锁定值的量级远小于基准量级，认为锁定失败，强置为 0
            expMax  = {c: 0, e: emax.e};
        }
        expFixMin(emin, expMax);                            // 将指数与量级较小者对齐
        expFixMin(emax, expMax);
        emin.c     += expMax.c - emax.c;                    // 最小值平移
        emax.c      = expMax.c;                             // 最大值锁定
    }
}


/**
 * 最小值和最大值同时被锁定的情况在这里，其它地方只考虑单边最值锁定
 * @param   {Number}    min         锁定的最小值
 * @param   {Number}    max         锁定的最大值
 * @param   {Number}    [section]   段数
 * @return  {Object}                同 smartSteps
 */
function bothLocked(min, max, section) {
    var trySecs     = section ? [section] : custSecs;
    var span        = max - min;
    if (span       === 0) {                                 // 最大最小值都锁定到同一个值上，认为锁定失败
        max         = expNum(max, 3);                       // 3 位精度向上近似
        section     = trySecs[0];
        max.c       = MATH_ROUND(max.c + section / 2);
        return makeResult(max.c - section, max.c, section, max.e);
    }
    if (MATH_ABS(max / span) < 1e-6) {                      // 如果锁定值远小于跨度，也认为锁定失败，强置为 0
        max         = 0;
    }
    if (MATH_ABS(min / span) < 1e-6) {
        min         = 0;
    }
    var step, deltaSpan, score;
    var scoreS      = [[5, 10], [10, 2], [50, 10], [100, 2]];
    var reference   = [];
    var debugLog    = [];
    var expSpan     = expNum((max - min), 3);               // 3 位精度向上近似
    var expMin      = expNum(min, -1, 1);
    var expMax      = expNum(max, -1);
    expFixTo(expMin, expSpan, 1);
    expFixTo(expMax, expSpan);
    span            = expMax.c - expMin.c;
    expSpan.c       = span;
    
    for (var i      = trySecs.length; i--;) {
        section     = trySecs[i];
        step        = MATH_CEIL(span / section);
        deltaSpan   = step * section - span;
        score       = (deltaSpan + 3) * 3;                  // 误差越大得分越高
        score      += (section - trySecs[0] + 2) * 2;       // 分段越多得分越高
        if (section % 5 === 0) {                            // 段数为 5 可以减分
            score  -= 10;
        }
        for (var j  = scoreS.length; j--;) {                // 好的步长是最重要的减分项
            if (step % scoreS[j][0] === 0) {
                score /= scoreS[j][1];
            }
        }
        debugLog[i] = [section, step, deltaSpan, score].join();
        reference[i] = {
            secs:   section,
            step:   step,
            delta:  deltaSpan,
            score:  score
        };
    }
    //console.log(debugLog);
    reference.sort(function (a, b) {return a.score - b.score;});
    reference   = reference[0];
    expMin.c    = MATH_ROUND(expMin.c - reference.delta / 2);
    expMax.c    = MATH_ROUND(expMax.c + reference.delta / 2);
    return makeResult(expMin.c, expMax.c, reference.secs, expSpan.e);
}




return smartSteps;
});



