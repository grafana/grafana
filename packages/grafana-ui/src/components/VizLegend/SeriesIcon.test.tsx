import { render } from '@testing-library/react';
import React from 'react';

import { SeriesIcon } from './SeriesIcon';

describe('SeriesIcon', () => {
  it('renders gradient correctly', () => {
    const { container } = render(<SeriesIcon gradient={'continuous-GrYlRd'} />);
    const div = container.firstChild! as HTMLDivElement;
    // There is issue in JSDOM which means we cannot actually get the gradient value. I guess if it's empty at least
    // we know it is setting some gradient instead of a single color.
    // https://github.com/jsdom/jsdom/issues/2166
    expect(div.style.getPropertyValue('background')).toBe('');
  });

  it('renders color correctly', () => {
    const { container } = render(<SeriesIcon color={'red'} />);
    const div = container.firstChild! as HTMLDivElement;
    expect(div.style.getPropertyValue('background')).toBe('red');
  });
});
