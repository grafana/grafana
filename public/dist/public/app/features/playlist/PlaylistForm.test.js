import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { PlaylistForm } from './PlaylistForm';
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, name = _b.name, interval = _b.interval, items = _b.items;
    var onSubmitMock = jest.fn();
    var playlist = { name: name, items: items, interval: interval };
    var rerender = render(React.createElement(PlaylistForm, { onSubmit: onSubmitMock, playlist: playlist })).rerender;
    return { onSubmitMock: onSubmitMock, playlist: playlist, rerender: rerender };
}
var playlist = {
    name: 'A test playlist',
    interval: '10m',
    items: [
        { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
        { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
        { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
    ],
};
function rows() {
    return screen.getAllByRole('row', { name: /playlist item row/i });
}
describe('PlaylistForm', function () {
    describe('when mounted without playlist', function () {
        it('then it should contain name and interval fields', function () {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toBeInTheDocument();
            expect(screen.queryByRole('row', { name: /playlist item row/i })).not.toBeInTheDocument();
        });
        it('then name field should have empty string as default value', function () {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('');
        });
        it('then interval field should have 5m as default value', function () {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5m');
        });
    });
    describe('when mounted with a playlist', function () {
        it('then name field should have correct value', function () {
            getTestContext(playlist);
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('A test playlist');
        });
        it('then interval field should have correct value', function () {
            getTestContext(playlist);
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('10m');
        });
        it('then items row count should be correct', function () {
            getTestContext(playlist);
            expect(screen.getAllByRole('row', { name: /playlist item row/i })).toHaveLength(3);
        });
        it('then the first item row should be correct', function () {
            getTestContext(playlist);
            expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
        });
        it('then the middle item row should be correct', function () {
            getTestContext(playlist);
            expectCorrectRow({ index: 1, type: 'id', title: 'middle item' });
        });
        it('then the last item row should be correct', function () {
            getTestContext(playlist);
            expectCorrectRow({ index: 2, type: 'tag', title: 'last item', last: true });
        });
    });
    describe('when deleting a playlist item', function () {
        it('then the item should be removed and other items should be correct', function () {
            getTestContext(playlist);
            expect(rows()).toHaveLength(3);
            userEvent.click(within(rows()[2]).getByRole('button', { name: /delete playlist item/i }));
            expect(rows()).toHaveLength(2);
            expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
            expectCorrectRow({ index: 1, type: 'id', title: 'middle item', last: true });
        });
    });
    describe('when moving a playlist item up', function () {
        it('then the item should be removed and other items should be correct', function () {
            getTestContext(playlist);
            userEvent.click(within(rows()[2]).getByRole('button', { name: /move playlist item order up/i }));
            expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
            expectCorrectRow({ index: 1, type: 'tag', title: 'last item' });
            expectCorrectRow({ index: 2, type: 'id', title: 'middle item', last: true });
        });
    });
    describe('when moving a playlist item down', function () {
        it('then the item should be removed and other items should be correct', function () {
            getTestContext(playlist);
            userEvent.click(within(rows()[0]).getByRole('button', { name: /move playlist item order down/i }));
            expectCorrectRow({ index: 0, type: 'id', title: 'middle item', first: true });
            expectCorrectRow({ index: 1, type: 'id', title: 'first item' });
            expectCorrectRow({ index: 2, type: 'tag', title: 'last item', last: true });
        });
    });
    describe('when submitting the form', function () {
        it('then the correct item should be submitted', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onSubmitMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        onSubmitMock = getTestContext(playlist).onSubmitMock;
                        fireEvent.submit(screen.getByRole('button', { name: /save/i }));
                        return [4 /*yield*/, waitFor(function () { return expect(onSubmitMock).toHaveBeenCalledTimes(1); })];
                    case 1:
                        _a.sent();
                        expect(onSubmitMock).toHaveBeenCalledWith(playlist);
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and name is missing', function () {
            it('then an alert should appear and nothing should be submitted', function () { return __awaiter(void 0, void 0, void 0, function () {
                var onSubmitMock, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            onSubmitMock = getTestContext(__assign(__assign({}, playlist), { name: undefined })).onSubmitMock;
                            fireEvent.submit(screen.getByRole('button', { name: /save/i }));
                            _a = expect;
                            return [4 /*yield*/, screen.findAllByRole('alert')];
                        case 1:
                            _a.apply(void 0, [_b.sent()]).toHaveLength(1);
                            expect(onSubmitMock).not.toHaveBeenCalled();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and interval is missing', function () {
            it('then an alert should appear and nothing should be submitted', function () { return __awaiter(void 0, void 0, void 0, function () {
                var onSubmitMock, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            onSubmitMock = getTestContext(playlist).onSubmitMock;
                            userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
                            fireEvent.submit(screen.getByRole('button', { name: /save/i }));
                            _a = expect;
                            return [4 /*yield*/, screen.findAllByRole('alert')];
                        case 1:
                            _a.apply(void 0, [_b.sent()]).toHaveLength(1);
                            expect(onSubmitMock).not.toHaveBeenCalled();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when items are missing', function () {
        it('then save button is disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                getTestContext(__assign(__assign({}, playlist), { items: [] }));
                expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
                return [2 /*return*/];
            });
        }); });
    });
});
function expectCorrectRow(_a) {
    var index = _a.index, type = _a.type, title = _a.title, _b = _a.first, first = _b === void 0 ? false : _b, _c = _a.last, last = _c === void 0 ? false : _c;
    var row = within(rows()[index]);
    var cell = "playlist item dashboard by " + type + " type " + title;
    var regex = new RegExp(cell, 'i');
    expect(row.getByRole('cell', { name: regex })).toBeInTheDocument();
    if (first) {
        expect(row.queryByRole('button', { name: /move playlist item order up/i })).not.toBeInTheDocument();
    }
    else {
        expect(row.getByRole('button', { name: /move playlist item order up/i })).toBeInTheDocument();
    }
    if (last) {
        expect(row.queryByRole('button', { name: /move playlist item order down/i })).not.toBeInTheDocument();
    }
    else {
        expect(row.getByRole('button', { name: /move playlist item order down/i })).toBeInTheDocument();
    }
    expect(row.getByRole('button', { name: /delete playlist item/i })).toBeInTheDocument();
}
//# sourceMappingURL=PlaylistForm.test.js.map