import { render, screen } from '@testing-library/react';
import React from 'react';
import { MappingType } from '@grafana/data';
import { ValueMappingsEditor } from './ValueMappingsEditor';
const setup = (propOverrides) => {
    const props = {
        onChange: jest.fn(),
        value: [
            {
                type: MappingType.ValueToText,
                options: {
                    '20': { text: 'Ok' },
                },
            },
            {
                type: MappingType.RangeToText,
                options: {
                    from: 21,
                    to: 30,
                    result: { text: 'Meh' },
                },
            },
        ],
        item: {},
        context: {
            data: [],
        },
    };
    Object.assign(props, propOverrides);
    render(React.createElement(ValueMappingsEditor, Object.assign({}, props)));
};
describe('Render', () => {
    it('should render component', () => {
        setup();
        const button = screen.getByText('Edit value mappings');
        expect(button).toBeInTheDocument();
    });
    it('should render icon picker when icon exists and icon setting is set to true', () => {
        const propOverrides = {
            item: { settings: { icon: true } },
            value: [
                {
                    type: MappingType.ValueToText,
                    options: {
                        '20': { text: 'Ok', icon: 'test' },
                    },
                },
            ],
        };
        setup(propOverrides);
        const iconPicker = screen.getByTestId('iconPicker');
        expect(iconPicker).toBeInTheDocument();
    });
});
//# sourceMappingURL=ValueMappingsEditor.test.js.map