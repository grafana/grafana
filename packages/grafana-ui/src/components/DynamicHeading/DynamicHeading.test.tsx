import { render, screen } from '@testing-library/react';

import { DynamicHeading } from './DynamicHeading';

describe('DynamicHeading', () => {
  it('should render h1 by default', () => {
    render(<DynamicHeading>Heading 1</DynamicHeading>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should render h2 when inside h1', () => {
    render(
      <section>
        <h1>Very important heading</h1>

        <DynamicHeading>Heading</DynamicHeading>
      </section>
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should render correctly inside landmarks', () => {
    render(
      <main>
        <h1>Main heading</h1>
        <section>
          <DynamicHeading>Section heading</DynamicHeading>
        </section>
      </main>
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should render correctly inside landmarks with already set heading', () => {
    render(
      <main>
        <h1>Main heading</h1>
        <section>
          <h2>Section</h2>
          <DynamicHeading>Section heading</DynamicHeading>
        </section>
      </main>
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});
