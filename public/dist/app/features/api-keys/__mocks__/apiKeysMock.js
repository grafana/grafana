import { OrgRole } from 'app/types';
export var getMultipleMockKeys = function (numberOfKeys) {
    var keys = [];
    for (var i = 1; i <= numberOfKeys; i++) {
        keys.push({
            id: i,
            name: "test-" + i,
            role: OrgRole.Viewer,
        });
    }
    return keys;
};
export var getMockKey = function () {
    return {
        id: 1,
        name: 'test',
        role: OrgRole.Admin,
    };
};
//# sourceMappingURL=apiKeysMock.js.map