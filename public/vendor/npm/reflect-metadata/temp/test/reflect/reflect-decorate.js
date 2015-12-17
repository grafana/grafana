// Reflect.decorate ( decorators, target [, propertyKey [, descriptor] ] )
require("../../Reflect");
var assert = require("assert");
function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForFunctionOverload() {
    var target = function () { };
    assert.throws(function () { return Reflect.decorate(undefined, target, undefined, undefined); }, TypeError);
}
exports.ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForFunctionOverload = ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForFunctionOverload;
function ReflectDecorateThrowsIfTargetArgumentNotFunctionForFunctionOverload() {
    var decorators = [];
    var target = {};
    assert.throws(function () { return Reflect.decorate(decorators, target, undefined, undefined); }, TypeError);
}
exports.ReflectDecorateThrowsIfTargetArgumentNotFunctionForFunctionOverload = ReflectDecorateThrowsIfTargetArgumentNotFunctionForFunctionOverload;
function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyOverload() {
    var target = {};
    var name = "name";
    assert.throws(function () { return Reflect.decorate(undefined, target, name, undefined); }, TypeError);
}
exports.ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyOverload = ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyOverload;
function ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyOverload() {
    var decorators = [];
    var target = 1;
    var name = "name";
    assert.throws(function () { return Reflect.decorate(decorators, target, name, undefined); }, TypeError);
}
exports.ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyOverload = ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyOverload;
function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyDescriptorOverload() {
    var target = {};
    var name = "name";
    var descriptor = {};
    assert.throws(function () { return Reflect.decorate(undefined, target, name, descriptor); }, TypeError);
}
exports.ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyDescriptorOverload = ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyDescriptorOverload;
function ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyDescriptorOverload() {
    var decorators = [];
    var target = 1;
    var name = "name";
    var descriptor = {};
    assert.throws(function () { return Reflect.decorate(decorators, target, name, descriptor); }, TypeError);
}
exports.ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyDescriptorOverload = ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyDescriptorOverload;
function ReflectDecorateExecutesDecoratorsInReverseOrderForFunctionOverload() {
    var order = [];
    var decorators = [
        function (target) { order.push(0); },
        function (target) { order.push(1); }
    ];
    var target = function () { };
    Reflect.decorate(decorators, target);
    assert.deepEqual(order, [1, 0]);
}
exports.ReflectDecorateExecutesDecoratorsInReverseOrderForFunctionOverload = ReflectDecorateExecutesDecoratorsInReverseOrderForFunctionOverload;
function ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyOverload() {
    var order = [];
    var decorators = [
        function (target, name) { order.push(0); },
        function (target, name) { order.push(1); }
    ];
    var target = {};
    var name = "name";
    Reflect.decorate(decorators, target, name, undefined);
    assert.deepEqual(order, [1, 0]);
}
exports.ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyOverload = ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyOverload;
function ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyDescriptorOverload() {
    var order = [];
    var decorators = [
        function (target, name) { order.push(0); },
        function (target, name) { order.push(1); }
    ];
    var target = {};
    var name = "name";
    var descriptor = {};
    Reflect.decorate(decorators, target, name, descriptor);
    assert.deepEqual(order, [1, 0]);
}
exports.ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyDescriptorOverload = ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyDescriptorOverload;
function ReflectDecoratorPipelineForFunctionOverload() {
    var A = function A() { };
    var B = function B() { };
    var decorators = [
        function (target) { return undefined; },
        function (target) { return A; },
        function (target) { return B; }
    ];
    var target = function () { };
    var result = Reflect.decorate(decorators, target);
    assert.strictEqual(result, A);
}
exports.ReflectDecoratorPipelineForFunctionOverload = ReflectDecoratorPipelineForFunctionOverload;
function ReflectDecoratorPipelineForPropertyOverload() {
    var A = {};
    var B = {};
    var decorators = [
        function (target, name) { return undefined; },
        function (target, name) { return A; },
        function (target, name) { return B; }
    ];
    var target = {};
    var result = Reflect.decorate(decorators, target, "name", undefined);
    assert.strictEqual(result, undefined);
}
exports.ReflectDecoratorPipelineForPropertyOverload = ReflectDecoratorPipelineForPropertyOverload;
function ReflectDecoratorPipelineForPropertyDescriptorOverload() {
    var A = {};
    var B = {};
    var C = {};
    var decorators = [
        function (target, name) { return undefined; },
        function (target, name) { return A; },
        function (target, name) { return B; }
    ];
    var target = {};
    var result = Reflect.decorate(decorators, target, "name", C);
    assert.strictEqual(result, A);
}
exports.ReflectDecoratorPipelineForPropertyDescriptorOverload = ReflectDecoratorPipelineForPropertyDescriptorOverload;
function ReflectDecoratorCorrectTargetInPipelineForFunctionOverload() {
    var sent = [];
    var A = function A() { };
    var B = function B() { };
    var decorators = [
        function (target) { sent.push(target); return undefined; },
        function (target) { sent.push(target); return undefined; },
        function (target) { sent.push(target); return A; },
        function (target) { sent.push(target); return B; }
    ];
    var target = function () { };
    Reflect.decorate(decorators, target);
    assert.deepEqual(sent, [target, B, A, A]);
}
exports.ReflectDecoratorCorrectTargetInPipelineForFunctionOverload = ReflectDecoratorCorrectTargetInPipelineForFunctionOverload;
function ReflectDecoratorCorrectTargetInPipelineForPropertyOverload() {
    var sent = [];
    var decorators = [
        function (target, name) { sent.push(target); },
        function (target, name) { sent.push(target); },
        function (target, name) { sent.push(target); },
        function (target, name) { sent.push(target); }
    ];
    var target = {};
    Reflect.decorate(decorators, target, "name");
    assert.deepEqual(sent, [target, target, target, target]);
}
exports.ReflectDecoratorCorrectTargetInPipelineForPropertyOverload = ReflectDecoratorCorrectTargetInPipelineForPropertyOverload;
function ReflectDecoratorCorrectNameInPipelineForPropertyOverload() {
    var sent = [];
    var decorators = [
        function (target, name) { sent.push(name); },
        function (target, name) { sent.push(name); },
        function (target, name) { sent.push(name); },
        function (target, name) { sent.push(name); }
    ];
    var target = {};
    Reflect.decorate(decorators, target, "name");
    assert.deepEqual(sent, ["name", "name", "name", "name"]);
}
exports.ReflectDecoratorCorrectNameInPipelineForPropertyOverload = ReflectDecoratorCorrectNameInPipelineForPropertyOverload;
function ReflectDecoratorCorrectTargetInPipelineForPropertyDescriptorOverload() {
    var sent = [];
    var A = {};
    var B = {};
    var C = {};
    var decorators = [
        function (target, name) { sent.push(target); return undefined; },
        function (target, name) { sent.push(target); return undefined; },
        function (target, name) { sent.push(target); return A; },
        function (target, name) { sent.push(target); return B; }
    ];
    var target = {};
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, [target, target, target, target]);
}
exports.ReflectDecoratorCorrectTargetInPipelineForPropertyDescriptorOverload = ReflectDecoratorCorrectTargetInPipelineForPropertyDescriptorOverload;
function ReflectDecoratorCorrectNameInPipelineForPropertyDescriptorOverload() {
    var sent = [];
    var A = {};
    var B = {};
    var C = {};
    var decorators = [
        function (target, name) { sent.push(name); return undefined; },
        function (target, name) { sent.push(name); return undefined; },
        function (target, name) { sent.push(name); return A; },
        function (target, name) { sent.push(name); return B; }
    ];
    var target = {};
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, ["name", "name", "name", "name"]);
}
exports.ReflectDecoratorCorrectNameInPipelineForPropertyDescriptorOverload = ReflectDecoratorCorrectNameInPipelineForPropertyDescriptorOverload;
function ReflectDecoratorCorrectDescriptorInPipelineForPropertyDescriptorOverload() {
    var sent = [];
    var A = {};
    var B = {};
    var C = {};
    var decorators = [
        function (target, name, descriptor) { sent.push(descriptor); return undefined; },
        function (target, name, descriptor) { sent.push(descriptor); return undefined; },
        function (target, name, descriptor) { sent.push(descriptor); return A; },
        function (target, name, descriptor) { sent.push(descriptor); return B; }
    ];
    var target = {};
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, [C, B, A, A]);
}
exports.ReflectDecoratorCorrectDescriptorInPipelineForPropertyDescriptorOverload = ReflectDecoratorCorrectDescriptorInPipelineForPropertyDescriptorOverload;
//# sourceMappingURL=reflect-decorate.js.map