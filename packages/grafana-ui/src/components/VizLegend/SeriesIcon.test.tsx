import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createTheme } from '@grafana/data';

import { SeriesIcon } from './SeriesIcon';

describe('SeriesIcon', () => {
  it('renders gradient correctly', () => {
    // Inspect React's serialized style because jsdom drops gradients from CSSOM.
    const markup = renderToStaticMarkup(<SeriesIcon gradient={'continuous-GrYlRd'} />);
    const { getColorByName } = createTheme().visualization;
    expect(markup).toContain(
      `background:linear-gradient(90deg, ${getColorByName('green')}, ${getColorByName('yellow')}, ${getColorByName('red')});`
    );
  });

  it('renders color correctly', () => {
    const { container } = render(<SeriesIcon color={'red'} />);
    const div = container.firstChild! as HTMLDivElement;
    expect(div.style.getPropertyValue('background')).toBe('red');
  });
});
