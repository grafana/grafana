import { render, screen } from '@testing-library/react';

import { QUERY_EDITOR_COLORS } from '../../constants';

import { CardTitle } from './CardTitle';

describe('CardTitle', () => {
  it('renders title text correctly', () => {
    render(<CardTitle title="Test Query" isHidden={false} />);

    expect(screen.getByText('Test Query')).toBeInTheDocument();
  });

  it('applies strikethrough style when isHidden is true', () => {
    const { container } = render(<CardTitle title="Hidden Query" isHidden={true} />);

    const titleSpan = container.querySelector('span');
    expect(titleSpan).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('does not apply strikethrough style when isHidden is false', () => {
    const { container } = render(<CardTitle title="Visible Query" isHidden={false} />);

    const titleSpan = container.querySelector('span');
    expect(titleSpan).toHaveStyle({ textDecoration: 'none' });
  });

  it('truncates long text', () => {
    const { container } = render(<CardTitle title="Very Long Query Name" isHidden={false} />);

    const titleSpan = container.querySelector('span');
    expect(titleSpan).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });

  it('applies error style when isError is true', () => {
    const { container } = render(<CardTitle title="Error Query" isHidden={false} isError={true} />);

    const titleSpan = container.querySelector('span');
    expect(titleSpan).toHaveStyle({ color: QUERY_EDITOR_COLORS.error });
  });
});
