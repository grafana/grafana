import { render, screen } from '@testing-library/react';

import { WidgetWrapper } from './WidgetWrapper';

const Dummy = () => <span data-testid="dummy"></span>;
describe('WidgetWrapper', () => {
  it('render children when request is not pending', () => {
    render(
      <WidgetWrapper title="Title" isPending={false}>
        <Dummy />
      </WidgetWrapper>
    );

    expect(screen.getByTestId('dummy')).toBeInTheDocument();
  });

  it('not render children when request is pending', () => {
    render(
      <WidgetWrapper title="Title" isPending={true}>
        <Dummy />
      </WidgetWrapper>
    );

    expect(screen.queryByTestId('dummy')).not.toBeInTheDocument();
  });

  it('render title properly', () => {
    render(
      <WidgetWrapper title="Test title">
        <Dummy />
      </WidgetWrapper>
    );

    expect(screen.getByText('Test title')).toBeInTheDocument();
  });
});
