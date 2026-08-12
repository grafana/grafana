import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import GettingStarted, { WelcomeHeader } from './GettingStarted';

describe('WelcomeHeader', () => {
  it('renders each call to action as a level 2 heading with a link', () => {
    render(<WelcomeHeader />);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Alert rules', 'Contact points', 'Notification policies']);

    expect(screen.getByTestId(selectors.pages.Alerting.Home.welcomeCtaLink('/alerting/list'))).toHaveAttribute(
      'href',
      '/alerting/list'
    );
  });
});

describe('GettingStarted', () => {
  it('renders both sections as level 3 headings', () => {
    render(<GettingStarted />);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['How it works', 'Get started']);
  });
});
