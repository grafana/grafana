import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import * as runtime from '@grafana/runtime';
import { customBuilder } from '../shared/testing/builders';
import { SLOW_VARIABLES_EXPANSION_THRESHOLD, VariablesUnknownTable, } from './VariablesUnknownTable';
import * as utils from './utils';
function getTestContext(overrides = {}, usages = []) {
    return __awaiter(this, void 0, void 0, function* () {
        jest.clearAllMocks();
        const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction').mockImplementation();
        const getUnknownsNetworkSpy = jest.spyOn(utils, 'getUnknownsNetwork').mockResolvedValue(usages);
        const defaults = {
            variables: [],
            dashboard: null,
        };
        const props = Object.assign(Object.assign({}, defaults), overrides);
        const { rerender } = render(React.createElement(VariablesUnknownTable, Object.assign({}, props)));
        yield waitFor(() => expect(screen.getByRole('heading', { name: /renamed or missing variables/i })).toBeInTheDocument());
        return { reportInteractionSpy, getUnknownsNetworkSpy, rerender };
    });
}
describe('VariablesUnknownTable', () => {
    describe('when rendered', () => {
        it('then it should render the section header', () => __awaiter(void 0, void 0, void 0, function* () {
            yield getTestContext();
        }));
    });
    describe('when expanding the section', () => {
        it('then it should call getUnknownsNetwork', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getUnknownsNetworkSpy } = yield getTestContext();
            yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
            yield waitFor(() => expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1));
        }));
        it('then it should report the interaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const { reportInteractionSpy } = yield getTestContext();
            yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
            expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
            expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
        }));
        describe('but when expanding it again without changes to variables or dashboard', () => {
            it('then it should not call getUnknownsNetwork', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getUnknownsNetworkSpy } = yield getTestContext();
                yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                yield waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));
                expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);
                yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                yield waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false'));
                yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                yield waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));
                expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);
            }));
        });
        describe('and there are no renamed or missing variables', () => {
            it('then it should render the correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                yield getTestContext();
                yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                expect(screen.getByText('No renamed or missing variables found.')).toBeInTheDocument();
            }));
        });
        describe('and there are renamed or missing variables', () => {
            it('then it should render the table', () => __awaiter(void 0, void 0, void 0, function* () {
                const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
                const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
                const { reportInteractionSpy } = yield getTestContext({}, usages);
                yield userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                expect(screen.queryByText('No renamed or missing variables found.')).not.toBeInTheDocument();
                expect(screen.getByText('Renamed Variable')).toBeInTheDocument();
                expect(screen.getAllByTestId('VariablesUnknownButton')).toHaveLength(1);
                // make sure we don't report the interaction for slow expansion
                expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
                expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
            }));
            describe('but when the unknown processing takes a while', () => {
                let user;
                beforeEach(() => {
                    jest.useFakeTimers();
                    // Need to use delay: null here to work with fakeTimers
                    // see https://github.com/testing-library/user-event/issues/833
                    user = userEvent.setup({ delay: null });
                });
                afterEach(() => {
                    jest.useRealTimers();
                });
                it('then it should report slow expansion', () => __awaiter(void 0, void 0, void 0, function* () {
                    const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
                    const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
                    const { getUnknownsNetworkSpy, reportInteractionSpy } = yield getTestContext({}, usages);
                    getUnknownsNetworkSpy.mockImplementation(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(usages);
                            }, SLOW_VARIABLES_EXPANSION_THRESHOLD);
                        });
                    });
                    yield user.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
                    jest.advanceTimersByTime(SLOW_VARIABLES_EXPANSION_THRESHOLD);
                    // make sure we report the interaction for slow expansion
                    yield waitFor(() => expect(reportInteractionSpy).toHaveBeenCalledWith('Slow unknown variables expansion', {
                        elapsed: expect.any(Number),
                    }));
                }));
            });
        });
    });
});
//# sourceMappingURL=VariablesUnknownTable.test.js.map