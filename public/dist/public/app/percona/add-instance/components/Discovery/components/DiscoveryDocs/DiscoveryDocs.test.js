import { render, screen } from '@testing-library/react';
import React from 'react';
import { DiscoveryDocs } from './DiscoveryDocs';
describe('DiscoveryDocs:: ', () => {
    it('should render list with two buttons for the docs', () => {
        render(React.createElement(DiscoveryDocs, null));
        expect(screen.getAllByRole('button')).toHaveLength(2);
    });
});
//# sourceMappingURL=DiscoveryDocs.test.js.map