import { __awaiter } from "tslib";
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PlaylistForm } from './PlaylistForm';
jest.mock('app/core/components/TagFilter/TagFilter', () => ({
    TagFilter: () => {
        return React.createElement(React.Fragment, null, "mocked-tag-filter");
    },
}));
function getTestContext({ name, interval, items, uid } = {}) {
    const onSubmitMock = jest.fn();
    const playlist = { name, items, interval, uid };
    const { rerender } = render(React.createElement(PlaylistForm, { onSubmit: onSubmitMock, playlist: playlist }));
    return { onSubmitMock, playlist, rerender };
}
const playlist = {
    name: 'A test playlist',
    interval: '10m',
    items: [
        { type: 'dashboard_by_uid', value: 'uid_1' },
        { type: 'dashboard_by_uid', value: 'uid_2' },
        { type: 'dashboard_by_tag', value: 'tag_A' },
    ],
    uid: 'foo',
};
function rows() {
    return screen.getAllByRole('row');
}
describe('PlaylistForm', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    describe('when mounted without playlist', () => {
        it('then it should contain name and interval fields', () => {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toBeInTheDocument();
            expect(screen.queryByRole('row')).not.toBeInTheDocument();
        });
        it('then name field should have empty string as default value', () => {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('');
        });
        it('then interval field should have 5m as default value', () => {
            getTestContext();
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5m');
        });
    });
    describe('when mounted with a playlist', () => {
        it('then name field should have correct value', () => {
            getTestContext(playlist);
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('A test playlist');
        });
        it('then interval field should have correct value', () => {
            getTestContext(playlist);
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('10m');
        });
        it('then items row count should be correct', () => {
            getTestContext(playlist);
            expect(screen.getAllByRole('row')).toHaveLength(3);
        });
        it('then the first item row should be correct', () => {
            getTestContext(playlist);
            expectCorrectRow({ index: 0, type: 'dashboard_by_uid', value: 'uid_1' });
            expectCorrectRow({ index: 1, type: 'dashboard_by_uid', value: 'uid_2' });
            expectCorrectRow({ index: 2, type: 'dashboard_by_tag', value: 'tag_A' });
        });
    });
    describe('when deleting a playlist item', () => {
        it('then the item should be removed and other items should be correct', () => __awaiter(void 0, void 0, void 0, function* () {
            getTestContext(playlist);
            expect(rows()).toHaveLength(3);
            yield userEvent.click(within(rows()[2]).getByRole('button', { name: /delete playlist item/i }));
            expect(rows()).toHaveLength(2);
            expectCorrectRow({ index: 0, type: 'dashboard_by_uid', value: 'uid_1' });
            expectCorrectRow({ index: 1, type: 'dashboard_by_uid', value: 'uid_2' });
        }));
    });
    describe('when submitting the form', () => {
        it('then the correct item should be submitted', () => __awaiter(void 0, void 0, void 0, function* () {
            const { onSubmitMock } = getTestContext(playlist);
            yield userEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(onSubmitMock).toHaveBeenCalledTimes(1);
            expect(onSubmitMock).toHaveBeenCalledWith({
                uid: 'foo',
                name: 'A test playlist',
                interval: '10m',
                items: [
                    { type: 'dashboard_by_uid', value: 'uid_1' },
                    { type: 'dashboard_by_uid', value: 'uid_2' },
                    { type: 'dashboard_by_tag', value: 'tag_A' },
                ],
            });
        }));
        describe('and name is missing', () => {
            it('then an alert should appear and nothing should be submitted', () => __awaiter(void 0, void 0, void 0, function* () {
                const { onSubmitMock } = getTestContext(Object.assign(Object.assign({}, playlist), { name: undefined }));
                yield userEvent.click(screen.getByRole('button', { name: /save/i }));
                expect(screen.getAllByRole('alert')).toHaveLength(1);
                expect(onSubmitMock).not.toHaveBeenCalled();
            }));
        });
        describe('and interval is missing', () => {
            it('then an alert should appear and nothing should be submitted', () => __awaiter(void 0, void 0, void 0, function* () {
                const { onSubmitMock } = getTestContext(playlist);
                yield userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
                yield userEvent.click(screen.getByRole('button', { name: /save/i }));
                expect(screen.getAllByRole('alert')).toHaveLength(1);
                expect(onSubmitMock).not.toHaveBeenCalled();
            }));
        });
    });
    describe('when items are missing', () => {
        it('then save button is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
            getTestContext(Object.assign(Object.assign({}, playlist), { items: [] }));
            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        }));
    });
});
function expectCorrectRow({ index, type, value }) {
    const row = within(rows()[index]);
    const cell = `Playlist item, ${type}, ${value}`;
    const regex = new RegExp(cell, 'i');
    expect(row.getByRole('cell', { name: regex })).toBeInTheDocument();
}
//# sourceMappingURL=PlaylistForm.test.js.map