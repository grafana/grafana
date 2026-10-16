import { render, screen } from '@testing-library/react';

import { type Field, FieldType } from '@grafana/data';

import { MarkdownCell } from './MarkdownCell';

it('renders cell admonitions as Alerts and sanitizes their contents', () => {
  const field: Field = {
    name: 'Guidance',
    type: FieldType.string,
    config: {},
    values: ['> [!TIP]\n> [Docs](https://grafana.com)<img src="x" onerror="alert(1)">'],
    display: (value) => ({ text: String(value), numeric: NaN }),
  };
  const { container } = render(<MarkdownCell field={field} rowIdx={0} />);
  expect(screen.getByRole('status', { name: 'Tip' })).toHaveTextContent('Docs');
  expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://grafana.com');
  expect(container.querySelector('[onerror]')).toBeNull();
});
