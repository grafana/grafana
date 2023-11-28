import { render, screen } from '@testing-library/react';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { PanelModel } from '../../state';
import PanelHeaderCorner from './PanelHeaderCorner';
const setup = () => {
    const testPanel = new PanelModel({ title: 'test', description: 'test panel' });
    const props = {
        panel: testPanel,
    };
    return render(React.createElement(PanelHeaderCorner, Object.assign({}, props)));
};
describe('Panel header corner test', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByRole('button', { name: selectors.components.Panels.Panel.headerCornerInfo('info') })).toBeInTheDocument();
    });
});
//# sourceMappingURL=PanelHeaderCorner.test.js.map