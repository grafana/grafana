import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { MappingType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ValueMappingsEditorModal } from './ValueMappingsEditorModal';
const setup = (spy, propOverrides) => {
    const props = {
        onClose: jest.fn(),
        onChange: (mappings) => {
            if (spy) {
                spy(mappings);
            }
        },
        value: [
            {
                type: MappingType.ValueToText,
                options: {
                    '20': {
                        text: 'Ok',
                        index: 0,
                    },
                },
            },
            {
                type: MappingType.RangeToText,
                options: {
                    from: 21,
                    to: 30,
                    result: {
                        text: 'Meh',
                        index: 1,
                    },
                },
            },
        ],
    };
    Object.assign(props, propOverrides);
    render(React.createElement(ValueMappingsEditorModal, Object.assign({}, props)));
};
describe('ValueMappingsEditorModal', () => {
    it('should render component', () => {
        setup();
    });
    describe('On remove mapping', () => {
        it('Should remove mapping at index 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChangeSpy = jest.fn();
            setup(onChangeSpy);
            yield userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);
            yield userEvent.click(screen.getByText('Update'));
            expect(onChangeSpy).toBeCalledWith([
                {
                    type: MappingType.RangeToText,
                    options: {
                        from: 21,
                        to: 30,
                        result: {
                            text: 'Meh',
                            index: 0,
                        },
                    },
                },
            ]);
        }));
    });
    describe('When adding and updating value mapp', () => {
        it('should be 3', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChangeSpy = jest.fn();
            setup(onChangeSpy);
            yield userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
            const selectComponent = yield screen.findByLabelText(selectors.components.ValuePicker.select('Add a new mapping'));
            yield selectOptionInTest(selectComponent, 'Value');
            const input = (yield screen.findAllByPlaceholderText('Exact value to match'))[1];
            yield userEvent.clear(input);
            yield userEvent.type(input, 'New');
            yield userEvent.clear(screen.getAllByPlaceholderText('Optional display text')[2]);
            yield userEvent.type(screen.getAllByPlaceholderText('Optional display text')[2], 'display');
            yield userEvent.click(screen.getByText('Update'));
            expect(onChangeSpy).toBeCalledWith([
                {
                    type: MappingType.ValueToText,
                    options: {
                        '20': {
                            text: 'Ok',
                            index: 0,
                        },
                        New: {
                            text: 'display',
                            index: 2,
                        },
                    },
                },
                {
                    type: MappingType.RangeToText,
                    options: {
                        from: 21,
                        to: 30,
                        result: {
                            text: 'Meh',
                            index: 1,
                        },
                    },
                },
            ]);
        }));
    });
    describe('When adding and updating range map', () => {
        it('should add new range map', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChangeSpy = jest.fn();
            setup(onChangeSpy, { value: [] });
            yield userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);
            yield userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
            const selectComponent = yield screen.findByLabelText(selectors.components.ValuePicker.select('Add a new mapping'));
            yield selectOptionInTest(selectComponent, 'Range');
            yield userEvent.clear(screen.getByPlaceholderText('Range start'));
            yield userEvent.type(screen.getByPlaceholderText('Range start'), '10');
            yield userEvent.clear(screen.getByPlaceholderText('Range end'));
            yield userEvent.type(screen.getByPlaceholderText('Range end'), '20');
            yield userEvent.clear(screen.getByPlaceholderText('Optional display text'));
            yield userEvent.type(screen.getByPlaceholderText('Optional display text'), 'display');
            yield userEvent.click(screen.getByText('Update'));
            expect(onChangeSpy).toBeCalledWith([
                {
                    type: MappingType.RangeToText,
                    options: {
                        from: 10,
                        to: 20,
                        result: {
                            text: 'display',
                            index: 0,
                        },
                    },
                },
            ]);
        }));
    });
    describe('When adding and updating regex map', () => {
        it('should add new regex map', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChangeSpy = jest.fn();
            setup(onChangeSpy, { value: [] });
            yield userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);
            yield userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
            const selectComponent = yield screen.findByLabelText(selectors.components.ValuePicker.select('Add a new mapping'));
            yield selectOptionInTest(selectComponent, 'Regex');
            yield userEvent.clear(screen.getByPlaceholderText('Regular expression'));
            yield userEvent.type(screen.getByPlaceholderText('Regular expression'), '(.*).example.com');
            yield userEvent.clear(screen.getByPlaceholderText('Optional display text'));
            yield userEvent.type(screen.getByPlaceholderText('Optional display text'), '$1');
            yield userEvent.click(screen.getByText('Update'));
            expect(onChangeSpy).toBeCalledWith([
                {
                    type: MappingType.RegexToText,
                    options: {
                        pattern: '(.*).example.com',
                        result: {
                            text: '$1',
                            index: 0,
                        },
                    },
                },
            ]);
        }));
    });
});
//# sourceMappingURL=ValueMappingsEditorModal.test.js.map