import { __makeTemplateObject } from "tslib";
import { standardFieldConfigEditorRegistry } from '@grafana/data';
import { setOptionImmutably, supportsDataQuery, updateDefaultFieldConfigValue } from './utils';
describe('standardFieldConfigEditorRegistry', function () {
    var dummyConfig = {
        displayName: 'Hello',
        min: 10,
        max: 10,
        decimals: 10,
        thresholds: {},
        noValue: 'no value',
        unit: 'km/s',
        links: {},
    };
    it('make sure all fields have a valid name', function () {
        standardFieldConfigEditorRegistry.list().forEach(function (v) {
            if (!dummyConfig.hasOwnProperty(v.id)) {
                fail("Registry uses unknown property: " + v.id);
            }
        });
    });
});
describe('supportsDataQuery', function () {
    describe('when called with plugin that supports queries', function () {
        it('then it should return true', function () {
            var plugin = { meta: { skipDataQuery: false } };
            expect(supportsDataQuery(plugin)).toBe(true);
        });
    });
    describe('when called with plugin that does not support queries', function () {
        it('then it should return false', function () {
            var plugin = { meta: { skipDataQuery: true } };
            expect(supportsDataQuery(plugin)).toBe(false);
        });
    });
    describe('when called without skipDataQuery', function () {
        it('then it should return false', function () {
            var plugin = { meta: {} };
            expect(supportsDataQuery(plugin)).toBe(false);
        });
    });
    describe('when called without plugin', function () {
        it('then it should return false', function () {
            expect(supportsDataQuery(undefined)).toBe(false);
        });
    });
});
describe('updateDefaultFieldConfigValue', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    property | isCustom | newValue                    | expected\n    ", "   | ", " | ", "                        | ", "\n    ", " | ", " | ", " | ", "\n    ", "   | ", " | ", "                | ", "\n    ", "   | ", " | ", "                | ", "\n    ", " | ", " | ", "                | ", "\n    ", "   | ", "  | ", "                        | ", "\n    ", " | ", "  | ", "  | ", "\n    ", "   | ", "  | ", "                | ", "\n    ", "   | ", "  | ", "                | ", "\n    ", " | ", "  | ", "                | ", "\n  "], ["\n    property | isCustom | newValue                    | expected\n    ", "   | ", " | ", "                        | ", "\n    ", " | ", " | ", " | ", "\n    ", "   | ", " | ", "                | ", "\n    ", "   | ", " | ", "                | ", "\n    ", " | ", " | ", "                | ", "\n    ", "   | ", "  | ", "                        | ", "\n    ", " | ", "  | ", "  | ", "\n    ", "   | ", "  | ", "                | ", "\n    ", "   | ", "  | ", "                | ", "\n    ", " | ", "  | ", "                | ", "\n  "])), 'a', false, 2, { a: 2, b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom' } } }, 'b.c', false, 'nested default updated', { a: 1, b: { c: 'nested default updated' }, custom: { d: 1, e: { f: 'nested custom' } } }, 'a', false, undefined, { b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom' } } }, 'b', false, undefined, { a: 1, custom: { d: 1, e: { f: 'nested custom' } } }, 'b.c', false, undefined, { a: 1, b: {}, custom: { d: 1, e: { f: 'nested custom' } } }, 'd', true, 2, { a: 1, b: { c: 'nested default' }, custom: { d: 2, e: { f: 'nested custom' } } }, 'e.f', true, 'nested custom updated', { a: 1, b: { c: 'nested default' }, custom: { d: 1, e: { f: 'nested custom updated' } } }, 'd', true, undefined, { a: 1, b: { c: 'nested default' }, custom: { e: { f: 'nested custom' } } }, 'e', true, undefined, { a: 1, b: { c: 'nested default' }, custom: { d: 1 } }, 'e.f', true, undefined, { a: 1, b: { c: 'nested default' }, custom: { d: 1, e: {} } })('when updating property:$property (is custom: $isCustom) with $newValue', function (_a) {
        var property = _a.property, isCustom = _a.isCustom, newValue = _a.newValue, expected = _a.expected;
        var config = {
            defaults: {
                a: 1,
                b: {
                    c: 'nested default',
                },
                custom: {
                    d: 1,
                    e: { f: 'nested custom' },
                },
            },
            overrides: [],
        };
        expect(updateDefaultFieldConfigValue(config, property, newValue, isCustom).defaults).toEqual(expected);
    });
});
describe('setOptionImmutably', function () {
    it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    source                    | path          | value     | expected\n    ", "                     | ", "        | ", "      | ", "\n    ", "                     | ", "    | ", " | ", "\n    ", "              | ", "    | ", " | ", "\n    ", "              | ", "    | ", " | ", "\n    ", " | ", "    | ", " | ", "\n    ", "                     | ", "   | ", "    | ", "\n    ", "                     | ", "     | ", "      | ", "\n    ", "                     | ", " | ", "      | ", "\n    ", "      | ", "   | ", "      | ", "\n  "], ["\n    source                    | path          | value     | expected\n    ", "                     | ", "        | ", "      | ", "\n    ", "                     | ", "    | ", " | ", "\n    ", "              | ", "    | ", " | ", "\n    ", "              | ", "    | ", " | ", "\n    ", " | ", "    | ", " | ", "\n    ", "                     | ", "   | ", "    | ", "\n    ", "                     | ", "     | ", "      | ", "\n    ", "                     | ", " | ", "      | ", "\n    ", "      | ", "   | ", "      | ", "\n  "])), {}, 'a', 1, { a: 1 }, {}, 'a.b.c', [1, 2], { a: { b: { c: [1, 2] } } }, { a: {} }, 'a.b.c', [1, 2], { a: { b: { c: [1, 2] } } }, { b: {} }, 'a.b.c', [1, 2], { a: { b: { c: [1, 2] } }, b: {} }, { a: { b: { c: 3 } } }, 'a.b.c', [1, 2], { a: { b: { c: [1, 2] } } }, {}, 'a.b[2]', 'x', { a: { b: [undefined, undefined, 'x'] } }, {}, 'a[0]', 1, { a: [1] }, {}, 'a[0].b.c', 1, { a: [{ b: { c: 1 } }] }, { a: [{ b: 1 }] }, 'a[0].c', 2, { a: [{ b: 1, c: 2 }] })('property value:${value', function (_a) {
        var source = _a.source, path = _a.path, value = _a.value, expected = _a.expected;
        expect(setOptionImmutably(source, path, value)).toEqual(expected);
    });
    it('does not mutate object under a path', function () {
        var input = { a: { b: { c: { d: 1 }, e: { f: 1 } } }, aa: 1 };
        var result = setOptionImmutably(input, 'a.b.c', { d: 2 });
        expect(input.a).not.toEqual(result.a);
        expect(input.aa).toEqual(result.aa);
        expect(input.a.b).not.toEqual(result.a.b);
        expect(input.a.b.c).not.toEqual(result.a.b.c);
        expect(input.a.b.e).toEqual(result.a.b.e);
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=utils.test.js.map