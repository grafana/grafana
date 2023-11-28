import { render } from '@testing-library/react';
import React from 'react';
import { DescriptionBlock } from './DescriptionBlock';
describe('DescriptionBlock', () => {
    it('should render description', () => {
        const { container } = render(React.createElement(DescriptionBlock, { description: "sample_description" }));
        expect(container.querySelector('pre')).toHaveTextContent('sample_description');
    });
});
//# sourceMappingURL=DescriptionBlock.test.js.map