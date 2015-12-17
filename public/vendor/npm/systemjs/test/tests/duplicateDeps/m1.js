System.register(["tests/duplicateDeps/m2.js", "tests/duplicateDeps/m2.js", "tests/duplicateDeps/m2.js"], function(exports_1) {
    var m2_1, m2_2;
    function foo() {
        return m2_1.f1() + m2_2.f2();
    }
    exports_1("foo", foo);
    return {
        setters:[
            function (_m2_1) {
                m2_1 = _m2_1;
            },
            function (_m2_2) {
                m2_2 = _m2_2;
            },
            function (_m2_3) {
                var reexports_1 = {};
                reexports_1["f3"] = _m2_3["f3"];
                exports_1(reexports_1);
            }],
        execute: function() {
        }
    }
});
