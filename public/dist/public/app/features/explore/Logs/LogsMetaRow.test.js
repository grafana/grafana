import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import saveAs from 'file-saver';
import React from 'react';
import { FieldType, LogLevel, LogsDedupStrategy, toDataFrame } from '@grafana/data';
import { MAX_CHARACTERS } from '../../logs/components/LogRowMessage';
import { logRowsToReadableJson } from '../../logs/utils';
import { LogsMetaRow } from './LogsMetaRow';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: () => null })));
jest.mock('file-saver', () => jest.fn());
const defaultProps = {
    meta: [],
    dedupStrategy: LogsDedupStrategy.none,
    dedupCount: 0,
    displayedFields: [],
    hasUnescapedContent: false,
    forceEscape: false,
    logRows: [],
    onEscapeNewlines: jest.fn(),
    clearDetectedFields: jest.fn(),
};
const setup = (propOverrides) => {
    const props = Object.assign(Object.assign({}, defaultProps), propOverrides);
    return render(React.createElement(LogsMetaRow, Object.assign({}, props)));
};
describe('LogsMetaRow', () => {
    it('renders the dedupe number', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ dedupStrategy: LogsDedupStrategy.numbers, dedupCount: 1234 });
        expect(yield screen.findByText('1234')).toBeInTheDocument();
    }));
    it('renders a highlighting warning', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ logRows: [{ entry: 'A'.repeat(MAX_CHARACTERS + 1) }] });
        expect(yield screen.findByText('Logs with more than 100,000 characters could not be parsed and highlighted')).toBeInTheDocument();
    }));
    it('renders the show original line button', () => {
        setup({ displayedFields: ['test'] });
        expect(screen.getByRole('button', {
            name: 'Show original line',
        })).toBeInTheDocument();
    });
    it('renders the displayedfield', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ displayedFields: ['testField1234'] });
        expect(yield screen.findByText('testField1234')).toBeInTheDocument();
    }));
    it('renders a button to clear displayedfields', () => {
        const clearSpy = jest.fn();
        setup({ displayedFields: ['testField1234'], clearDetectedFields: clearSpy });
        fireEvent(screen.getByRole('button', {
            name: 'Show original line',
        }), new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        }));
        expect(clearSpy).toBeCalled();
    });
    it('renders a button to remove escaping', () => {
        setup({ hasUnescapedContent: true, forceEscape: true });
        expect(screen.getByRole('button', {
            name: 'Remove escaping',
        })).toBeInTheDocument();
    });
    it('renders a button to remove escaping', () => {
        setup({ hasUnescapedContent: true, forceEscape: false });
        expect(screen.getByRole('button', {
            name: 'Escape newlines',
        })).toBeInTheDocument();
    });
    it('renders a button to remove escaping', () => {
        const escapeSpy = jest.fn();
        setup({ hasUnescapedContent: true, forceEscape: false, onEscapeNewlines: escapeSpy });
        fireEvent(screen.getByRole('button', {
            name: 'Escape newlines',
        }), new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        }));
        expect(escapeSpy).toBeCalled();
    });
    it('renders a button to show the download menu', () => {
        setup();
        expect(screen.getByText('Download').closest('button')).toBeInTheDocument();
    });
    it('renders a button to show the download menu', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.queryAllByText('txt')).toHaveLength(0);
        yield userEvent.click(screen.getByText('Download').closest('button'));
        expect(screen.getByRole('menuitem', {
            name: 'txt',
        })).toBeInTheDocument();
    }));
    it('renders a button to download txt', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield userEvent.click(screen.getByText('Download').closest('button'));
        yield userEvent.click(screen.getByRole('menuitem', {
            name: 'txt',
        }));
        expect(saveAs).toBeCalled();
    }));
    it('renders a button to download json', () => __awaiter(void 0, void 0, void 0, function* () {
        const rows = [
            {
                rowIndex: 1,
                entryFieldIndex: 0,
                dataFrame: toDataFrame({
                    name: 'logs',
                    fields: [
                        {
                            name: 'time',
                            type: FieldType.time,
                            values: ['1970-01-01T00:00:00Z'],
                        },
                        {
                            name: 'message',
                            type: FieldType.string,
                            values: ['INFO 1'],
                            labels: {
                                foo: 'bar',
                            },
                        },
                    ],
                }),
                entry: 'test entry',
                hasAnsi: false,
                hasUnescapedContent: false,
                labels: {
                    foo: 'bar',
                },
                logLevel: LogLevel.info,
                raw: '',
                timeEpochMs: 10,
                timeEpochNs: '123456789',
                timeFromNow: '',
                timeLocal: '',
                timeUtc: '',
                uid: '2',
            },
        ];
        setup({ logRows: rows });
        yield userEvent.click(screen.getByText('Download').closest('button'));
        yield userEvent.click(screen.getByRole('menuitem', {
            name: 'json',
        }));
        expect(saveAs).toBeCalled();
        const blob = saveAs.mock.lastCall[0];
        expect(blob.type).toBe('application/json;charset=utf-8');
        const text = yield blob.text();
        expect(text).toBe(JSON.stringify(logRowsToReadableJson(rows)));
    }));
});
//# sourceMappingURL=LogsMetaRow.test.js.map