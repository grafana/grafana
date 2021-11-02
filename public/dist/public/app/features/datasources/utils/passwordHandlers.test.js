import { createResetHandler, PasswordFieldEnum } from './passwordHandlers';
describe('createResetHandler', function () {
    Object.values(PasswordFieldEnum).forEach(function (field) {
        it("should reset existing " + field + " field", function () {
            var _a, _b, _c, _d, _e;
            var event = {
                preventDefault: function () { },
            };
            var ctrl = {
                current: (_a = {},
                    _a[field] = 'set',
                    _a.secureJsonData = (_b = {},
                        _b[field] = 'set',
                        _b),
                    _a.secureJsonFields = {},
                    _a),
            };
            createResetHandler(ctrl, field)(event);
            expect(ctrl).toEqual({
                current: (_c = {},
                    _c[field] = undefined,
                    _c.secureJsonData = (_d = {},
                        _d[field] = '',
                        _d),
                    _c.secureJsonFields = (_e = {},
                        _e[field] = false,
                        _e),
                    _c),
            });
        });
    });
});
//# sourceMappingURL=passwordHandlers.test.js.map