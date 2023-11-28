import { render } from '@testing-library/react';
import React from 'react';
import { OptionContent } from './OptionContent';
const title = 'Shared Blocks Written';
const description = 'Total number of shared blocks written by the statement';
const tags = ['mysql', 'postgresql'];
describe('OptionContent::', () => {
    it('should render with title, description and tags', () => {
        const { container } = render(React.createElement(OptionContent, { title: title, description: description, tags: tags }));
        const spans = container.querySelectorAll('div > div > span');
        expect(spans[0]).toHaveTextContent(title);
        expect(spans[1]).toHaveTextContent(description);
        expect(spans[2]).toHaveTextContent(tags[0]);
        expect(spans[3]).toHaveTextContent(tags[1]);
    });
    it('should render with title, description and one tag', () => {
        const { container } = render(React.createElement(OptionContent, { title: title, description: description, tags: [tags[0]] }));
        const spans = container.querySelectorAll('div > div > span');
        expect(spans[0]).toHaveTextContent(title);
        expect(spans[1]).toHaveTextContent(description);
        expect(spans[2]).toHaveTextContent(tags[0]);
    });
    it('should render with title, description and empty tags', () => {
        const { container } = render(React.createElement(OptionContent, { title: title, description: description, tags: [] }));
        const spans = container.querySelectorAll('div > div > span');
        expect(spans[0]).toHaveTextContent(title);
        expect(spans[1]).toHaveTextContent(description);
        expect(spans).toHaveLength(2);
    });
});
//# sourceMappingURL=OptionContent.test.js.map