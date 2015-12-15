// Reflect.decorate ( decorators, target [, propertyKey [, descriptor] ] )

import "../../Reflect";
import * as assert from "assert";

export function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForFunctionOverload() {
    let target = function() { };
    assert.throws(() => Reflect.decorate(undefined, target, undefined, undefined), TypeError);
}

export function ReflectDecorateThrowsIfTargetArgumentNotFunctionForFunctionOverload() {
    let decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];
    let target = {};
    assert.throws(() => Reflect.decorate(decorators, target, undefined, undefined), TypeError);
}

export function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyOverload() {
    let target = {};
    let name = "name";
    assert.throws(() => Reflect.decorate(undefined, target, name, undefined), TypeError);
}

export function ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyOverload() {
    let decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];
    let target = 1;
    let name = "name";
    assert.throws(() => Reflect.decorate(decorators, target, name, undefined), TypeError);
}

export function ReflectDecorateThrowsIfDecoratorsArgumentNotArrayForPropertyDescriptorOverload() {
    let target = {};
    let name = "name";
    let descriptor = {};
    assert.throws(() => Reflect.decorate(undefined, target, name, descriptor), TypeError);
}

export function ReflectDecorateThrowsIfTargetArgumentNotObjectForPropertyDescriptorOverload() {
    let decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];
    let target = 1;
    let name = "name";
    let descriptor = {};
    assert.throws(() => Reflect.decorate(decorators, target, name, descriptor), TypeError);
}

export function ReflectDecorateExecutesDecoratorsInReverseOrderForFunctionOverload() {
    let order: number[] = [];
    let decorators = [
        (target: Function): void => { order.push(0); },
        (target: Function): void => { order.push(1); }
    ];
    let target = function() { };
    Reflect.decorate(decorators, target);
    assert.deepEqual(order, [1, 0]);
}

export function ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyOverload() {
    let order: number[] = [];
    let decorators = [
        (target: Object, name: string | symbol): void => { order.push(0); },
        (target: Object, name: string | symbol): void => { order.push(1); }
    ];
    let target = {};
    let name = "name";
    Reflect.decorate(decorators, target, name, undefined);
    assert.deepEqual(order, [1, 0]);
}

export function ReflectDecorateExecutesDecoratorsInReverseOrderForPropertyDescriptorOverload() {
    let order: number[] = [];
    let decorators = [
        (target: Object, name: string | symbol): void => { order.push(0); },
        (target: Object, name: string | symbol): void => { order.push(1); }
    ];
    let target = {};
    let name = "name";
    let descriptor = {};
    Reflect.decorate(decorators, target, name, descriptor);
    assert.deepEqual(order, [1, 0]);
}

export function ReflectDecoratorPipelineForFunctionOverload() {
    let A = function A(): void { };
    let B = function B(): void { };
    let decorators = [
        (target: Function): any => { return undefined; },
        (target: Function): any => { return A; },
        (target: Function): any => { return B; }
    ];
    let target = function (): void { };
    let result = Reflect.decorate(decorators, target);
    assert.strictEqual(result, A);
}

export function ReflectDecoratorPipelineForPropertyOverload() {
    let A = {};
    let B = {};
    let decorators = [
        (target: Object, name: string | symbol): any => { return undefined; },
        (target: Object, name: string | symbol): any => { return A; },
        (target: Object, name: string | symbol): any => { return B; }
    ];
    let target = {};
    let result = Reflect.decorate(decorators, target, "name", undefined);
    assert.strictEqual(result, undefined);
}

export function ReflectDecoratorPipelineForPropertyDescriptorOverload() {
    let A = {};
    let B = {};
    let C = {};
    let decorators = [
        (target: Object, name: string | symbol): any => { return undefined; },
        (target: Object, name: string | symbol): any => { return A; },
        (target: Object, name: string | symbol): any => { return B; }
    ];
    let target = {};
    let result = Reflect.decorate(decorators, target, "name", C);
    assert.strictEqual(result, A);
}

export function ReflectDecoratorCorrectTargetInPipelineForFunctionOverload() {
    let sent: Function[] = [];
    let A = function A(): void { };
    let B = function B(): void { };
    let decorators = [
        (target: Function): any => { sent.push(target); return undefined; },
        (target: Function): any => { sent.push(target); return undefined; },
        (target: Function): any => { sent.push(target); return A; },
        (target: Function): any => { sent.push(target); return B; }
    ];
    let target = function (): void { };
    Reflect.decorate(decorators, target);
    assert.deepEqual(sent, [target, B, A, A]);
}

export function ReflectDecoratorCorrectTargetInPipelineForPropertyOverload() {
    let sent: Object[] = [];
    let decorators = [
        (target: Object, name: string | symbol): any => { sent.push(target); },
        (target: Object, name: string | symbol): any => { sent.push(target); },
        (target: Object, name: string | symbol): any => { sent.push(target); },
        (target: Object, name: string | symbol): any => { sent.push(target); }
    ];
    let target = { };
    Reflect.decorate(decorators, target, "name");
    assert.deepEqual(sent, [target, target, target, target]);
}

export function ReflectDecoratorCorrectNameInPipelineForPropertyOverload() {
    let sent: (symbol | string)[] = [];
    let decorators = [
        (target: Object, name: string | symbol): any => { sent.push(name); },
        (target: Object, name: string | symbol): any => { sent.push(name); },
        (target: Object, name: string | symbol): any => { sent.push(name); },
        (target: Object, name: string | symbol): any => { sent.push(name); }
    ];
    let target = { };
    Reflect.decorate(decorators, target, "name");
    assert.deepEqual(sent, ["name", "name", "name", "name"]);
}

export function ReflectDecoratorCorrectTargetInPipelineForPropertyDescriptorOverload() {
    let sent: Object[] = [];
    let A = { };
    let B = { };
    let C = { };
    let decorators = [
        (target: Object, name: string | symbol): any => { sent.push(target); return undefined; },
        (target: Object, name: string | symbol): any => { sent.push(target); return undefined; },
        (target: Object, name: string | symbol): any => { sent.push(target); return A; },
        (target: Object, name: string | symbol): any => { sent.push(target); return B; }
    ];
    let target = { };
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, [target, target, target, target]);
}

export function ReflectDecoratorCorrectNameInPipelineForPropertyDescriptorOverload() {
    let sent: (symbol | string)[] = [];
    let A = { };
    let B = { };
    let C = { };
    let decorators = [
        (target: Object, name: string | symbol): any => { sent.push(name); return undefined; },
        (target: Object, name: string | symbol): any => { sent.push(name); return undefined; },
        (target: Object, name: string | symbol): any => { sent.push(name); return A; },
        (target: Object, name: string | symbol): any => { sent.push(name); return B; }
    ];
    let target = { };
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, ["name", "name", "name", "name"]);
}

export function ReflectDecoratorCorrectDescriptorInPipelineForPropertyDescriptorOverload() {
    let sent: PropertyDescriptor[] = [];
    let A = { };
    let B = { };
    let C = { };
    let decorators = [
        (target: Object, name: string | symbol, descriptor: PropertyDescriptor): any => { sent.push(descriptor); return undefined; },
        (target: Object, name: string | symbol, descriptor: PropertyDescriptor): any => { sent.push(descriptor); return undefined; },
        (target: Object, name: string | symbol, descriptor: PropertyDescriptor): any => { sent.push(descriptor); return A; },
        (target: Object, name: string | symbol, descriptor: PropertyDescriptor): any => { sent.push(descriptor); return B; }
    ];
    let target = { };
    Reflect.decorate(decorators, target, "name", C);
    assert.deepEqual(sent, [C, B, A, A]);
}