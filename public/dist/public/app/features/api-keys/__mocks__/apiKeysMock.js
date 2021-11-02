import { OrgRole } from 'app/types';
export var getMultipleMockKeys = function (numberOfKeys) {
    var keys = [];
    for (var i = 1; i <= numberOfKeys; i++) {
        keys.push({
            id: i,
            name: "test-" + i,
            role: OrgRole.Viewer,
            secondsToLive: 100,
            expiration: '2019-06-04',
        });
    }
    return keys;
};
export var getMockKey = function () {
    return {
        id: 1,
        name: 'test',
        role: OrgRole.Admin,
        secondsToLive: 200,
        expiration: '2019-06-04',
    };
};
//# sourceMappingURL=apiKeysMock.js.map