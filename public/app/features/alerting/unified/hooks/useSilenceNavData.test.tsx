import { render } from '@testing-library/react';
import { useMatch } from 'react-router-dom-v5-compat';

import { useSilenceNavData } from './useSilenceNavData';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useMatch: jest.fn(),
}));

const setup = () => {
  let result: ReturnType<typeof useSilenceNavData>;
  function TestComponent() {
    result = useSilenceNavData();
    return null;
  }

  render(<TestComponent />);

  return { result };
};
describe('useSilenceNavData', () => {
  it('should return correct nav data when route is "/alerting/silence/new"', () => {
    (useMatch as jest.Mock).mockImplementation((param) => param === '/alerting/silence/new');
    const { result } = setup();

    expect(result).toMatchObject({
      text: 'Silence alert rule',
    });
  });

  it('should return correct nav data when route is "/alerting/silence/:id/edit"', () => {
    (useMatch as jest.Mock).mockImplementation((param) => param === '/alerting/silence/:id/edit');
    const { result } = setup();

    expect(result).toMatchObject({
      text: 'Edit silence',
    });
  });
});
