import React from 'react';
import { render, screen } from '@testing-library/react';
import { FieldColorModeId } from '@grafana/data';
import { Legend } from './Legend';
describe('Legend', function () {
    it('renders ok without nodes', function () {
        render(React.createElement(Legend, { nodes: [], onSort: function (sort) { }, sortable: false }));
    });
    it('renders ok with color fields', function () {
        var nodes = [
            {
                id: 'nodeId',
                mainStat: { config: { displayName: 'stat1' } },
                secondaryStat: { config: { displayName: 'stat2' } },
                arcSections: [
                    { config: { displayName: 'error', color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } } },
                ],
            },
        ];
        render(React.createElement(Legend, { nodes: nodes, onSort: function (sort) { }, sortable: false }));
        var items = screen.getAllByLabelText(/VizLegend series/);
        expect(items.length).toBe(3);
        var item = screen.getByLabelText(/VizLegend series error/);
        expect(item.firstChild.style.getPropertyValue('background')).toBe('rgb(242, 73, 92)');
    });
});
//# sourceMappingURL=Legend.test.js.map