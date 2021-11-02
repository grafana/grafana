import { isOnTheSameGridRow } from './utils';
import { REPEAT_DIR_HORIZONTAL } from '../../../core/constants';
describe('isOnTheSameGridRow', function () {
    describe('when source panel is next to a panel', function () {
        it('then it should return true', function () {
            var sourcePanel = { gridPos: { x: 0, y: 1, w: 4, h: 4 } };
            var otherPanel = { gridPos: { x: 4, y: 1, w: 4, h: 4 } };
            expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(true);
        });
    });
    describe('when source panel is not next to a panel', function () {
        it('then it should return false', function () {
            var sourcePanel = { gridPos: { x: 0, y: 1, w: 4, h: 4 } };
            var otherPanel = { gridPos: { x: 4, y: 5, w: 4, h: 4 } };
            expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
        });
    });
    describe('when source panel is repeated horizontally', function () {
        it('then it should return false', function () {
            var sourcePanel = {
                gridPos: { x: 0, y: 1, w: 4, h: 4 },
                repeatDirection: REPEAT_DIR_HORIZONTAL,
            };
            var otherPanel = { gridPos: { x: 4, y: 1, w: 4, h: 4 } };
            expect(isOnTheSameGridRow(sourcePanel, otherPanel)).toBe(false);
        });
    });
});
//# sourceMappingURL=utils.test.js.map