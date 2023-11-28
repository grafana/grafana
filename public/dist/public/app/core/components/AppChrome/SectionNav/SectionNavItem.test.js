import { render, screen } from '@testing-library/react';
import React from 'react';
import { SectionNavItem } from './SectionNavItem';
describe('SectionNavItem', () => {
    it('should only show the img for a section root if both img and icon are present', () => {
        const item = {
            text: 'Test',
            icon: 'k6',
            img: 'img',
            children: [
                {
                    text: 'Child',
                },
            ],
        };
        render(React.createElement(SectionNavItem, { item: item, isSectionRoot: true }));
        expect(screen.getByTestId('section-image')).toBeInTheDocument();
        expect(screen.queryByTestId('section-icon')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=SectionNavItem.test.js.map