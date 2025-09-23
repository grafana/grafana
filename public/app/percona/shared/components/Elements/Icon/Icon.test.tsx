import { render, screen } from '@testing-library/react';

import { Icon } from './Icon';

describe('Icon::', () => {
  it('should display the correct icon', async () => {
    render(<Icon name="plusSquare" role="img" />);

    expect(await screen.findByRole('img')).toBeInTheDocument();
  });
});
