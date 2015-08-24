/**
 * 高精度数学运算
 */
define(function() {
    // 除法函数，用来得到精确的除法结果 
    // 说明：javascript的除法结果会有误差，在两个浮点数相除的时候会比较明显。这个函数返回较为精确的除法结果。 
    // 调用：accDiv(arg1,arg2) 
    // 返回值：arg1除以arg2的精确结果
    function accDiv(arg1,arg2){
        var s1 = arg1.toString();
        var s2 = arg2.toString(); 
        var m = 0;
        try {
            m = s2.split('.')[1].length;
        }
        catch(e) {}
        try {
            m -= s1.split('.')[1].length;
        }
        catch(e) {}
        
        return (s1.replace('.', '') - 0) / (s2.replace('.', '') - 0) * Math.pow(10, m);
    }

    // 乘法函数，用来得到精确的乘法结果
    // 说明：javascript的乘法结果会有误差，在两个浮点数相乘的时候会比较明显。这个函数返回较为精确的乘法结果。 
    // 调用：accMul(arg1,arg2) 
    // 返回值：arg1乘以arg2的精确结果
    function accMul(arg1, arg2) {
        var s1 = arg1.toString();
        var s2 = arg2.toString();
        var m = 0;
        try {
            m += s1.split('.')[1].length;
        }
        catch(e) {}
        try {
            m += s2.split('.')[1].length;
        }
        catch(e) {}
        
        return (s1.replace('.', '') - 0) * (s2.replace('.', '') - 0) / Math.pow(10, m);
    }

    // 加法函数，用来得到精确的加法结果 
    // 说明：javascript的加法结果会有误差，在两个浮点数相加的时候会比较明显。这个函数返回较为精确的加法结果。 
    // 调用：accAdd(arg1,arg2) 
    // 返回值：arg1加上arg2的精确结果 
    function accAdd(arg1, arg2) {
        var r1 = 0;
        var r2 = 0;
        try {
            r1 = arg1.toString().split('.')[1].length;
        }
        catch(e) {}
        try {
            r2 = arg2.toString().split('.')[1].length;
        }
        catch(e) {}
        
        var m = Math.pow(10, Math.max(r1, r2));
        return (Math.round(arg1 * m) + Math.round(arg2 * m)) / m; 
    }

    //减法函数，用来得到精确的减法结果 
    //说明：javascript的减法结果会有误差，在两个浮点数减法的时候会比较明显。这个函数返回较为精确的减法结果。 
    //调用：accSub(arg1,arg2) 
    //返回值：arg1减法arg2的精确结果 
    function accSub(arg1,arg2) {
        return accAdd(arg1, -arg2);
    }

    return {
        accDiv : accDiv,
        accMul : accMul,
        accAdd : accAdd,
        accSub : accSub
    };
});