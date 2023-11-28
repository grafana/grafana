import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { TempoVariableQueryEditor, TempoVariableQueryType, } from './VariableQueryEditor';
import { createTempoDatasource } from './mocks';
const refId = 'TempoDatasourceVariableQueryEditor-VariableQuery';
describe('TempoVariableQueryEditor', () => {
    let props;
    let onChange;
    beforeEach(() => {
        props = {
            datasource: createTempoDatasource({}),
            query: { type: 0, refId: 'test' },
            onChange: (_) => { },
        };
        onChange = jest.fn();
    });
    test('Allows to create a Label names variable', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(onChange).not.toHaveBeenCalled();
        render(React.createElement(TempoVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');
        yield userEvent.click(document.body);
        expect(onChange).toHaveBeenCalledWith({
            type: TempoVariableQueryType.LabelNames,
            label: '',
            refId,
        });
    }));
    test('Allows to create a Label values variable', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([
            {
                text: 'moon',
            },
            {
                text: 'luna',
            },
        ]);
        expect(onChange).not.toHaveBeenCalled();
        render(React.createElement(TempoVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        yield selectOptionInTest(screen.getByLabelText('Label'), 'luna');
        yield userEvent.click(document.body);
        expect(onChange).toHaveBeenCalledWith({
            type: TempoVariableQueryType.LabelValues,
            label: 'luna',
            refId,
        });
    }));
});
//# sourceMappingURL=VariableQueryEditor.test.js.map