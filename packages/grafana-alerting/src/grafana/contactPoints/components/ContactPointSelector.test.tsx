import { render, screen } from '@grafana/test-utils';
import { setupMockServer } from '@grafana/test-utils/server';
import { fixtures } from '@grafana/test-utils/unstable';

import { ContactPointSelector } from './ContactPointSelector';

setupMockServer();

beforeAll(() => {
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });
});

describe('ContactPointSelector', () => {
  it('should render dropdown with contact points', async () => {
    const onChange = jest.fn();
    const { user } = render(<ContactPointSelector onChange={onChange} />);

    expect(await screen.findByRole('combobox')).toBeInTheDocument();

    const input = screen.getByRole('combobox');
    await user.click(input);

    const item = await screen.findByRole('option', { name: new RegExp(fixtures.alerting.CONTACT_POINT_EMAIL_TITLE) });
    await user.click(item);
    expect(screen.getByDisplayValue(fixtures.alerting.CONTACT_POINT_EMAIL_TITLE)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ spec: expect.objectContaining({ title: fixtures.alerting.CONTACT_POINT_EMAIL_TITLE }) })
    );
  });
});
