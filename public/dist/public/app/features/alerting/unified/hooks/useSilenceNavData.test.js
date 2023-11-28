import { render } from '@testing-library/react';
import React from 'react';
import { useRouteMatch } from 'react-router-dom';
import { useSilenceNavData } from './useSilenceNavData';
jest.mock('react-router-dom', () => (Object.assign(Object.assign({}, jest.requireActual('react-router-dom')), { useRouteMatch: jest.fn() })));
const setup = () => {
    let result;
    function TestComponent() {
        result = useSilenceNavData();
        return null;
    }
    render(React.createElement(TestComponent, null));
    return { result };
};
describe('useSilenceNavData', () => {
    it('should return correct nav data when route is "/alerting/silence/new"', () => {
        useRouteMatch.mockReturnValue({ isExact: true, path: '/alerting/silence/new' });
        const { result } = setup();
        expect(result).toEqual({
            icon: 'bell-slash',
            id: 'silence-new',
            text: 'Add silence',
        });
    });
    it('should return correct nav data when route is "/alerting/silence/:id/edit"', () => {
        useRouteMatch.mockReturnValue({ isExact: true, path: '/alerting/silence/:id/edit' });
        const { result } = setup();
        expect(result).toEqual({
            icon: 'bell-slash',
            id: 'silence-edit',
            text: 'Edit silence',
        });
    });
});
//# sourceMappingURL=useSilenceNavData.test.js.map