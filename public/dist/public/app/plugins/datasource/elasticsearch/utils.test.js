import { removeEmpty } from './utils';
describe('removeEmpty', function () {
    it('Should remove all empty', function () {
        var original = {
            stringsShouldBeKept: 'Something',
            unlessTheyAreEmpty: '',
            nullToBeRemoved: null,
            undefinedToBeRemoved: null,
            zeroShouldBeKept: 0,
            booleansShouldBeKept: false,
            emptyObjectsShouldBeRemoved: {},
            emptyArrayShouldBeRemoved: [],
            nonEmptyArraysShouldBeKept: [1, 2, 3],
            nestedObjToBeRemoved: {
                toBeRemoved: undefined,
            },
            nestedObjectToKeep: {
                thisShouldBeRemoved: null,
                thisShouldBeKept: 'Hello, Grafana',
            },
        };
        var expectedResult = {
            stringsShouldBeKept: 'Something',
            zeroShouldBeKept: 0,
            booleansShouldBeKept: false,
            nonEmptyArraysShouldBeKept: [1, 2, 3],
            nestedObjectToKeep: {
                thisShouldBeKept: 'Hello, Grafana',
            },
        };
        expect(removeEmpty(original)).toStrictEqual(expectedResult);
    });
});
//# sourceMappingURL=utils.test.js.map