import { render, screen } from '@testing-library/react';
import React from 'react';
import { Messages } from 'app/percona/settings/Settings.messages';
import { Diagnostics } from './Diagnostics';
describe('Diagnostics::', () => {
    it('Renders diagnostics correctly', () => {
        const { diagnostics: { action, label }, } = Messages;
        render(React.createElement(Diagnostics, null));
        expect(screen.getByTestId('diagnostics-label')).toHaveTextContent(label);
        expect(screen.getByTestId('diagnostics-button')).toHaveTextContent(action);
    });
});
//# sourceMappingURL=Diagnostics.test.js.map