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

it('preserves the sanitization opt-out and updates admonitions when cell content changes', () => {
  const field: Field = {
    name: 'Guidance',
    type: FieldType.string,
    config: {},
    values: ['> [!TIP]\n> <input aria-label="Custom input" value="Original">'],
    display: (value) => ({ text: String(value), numeric: NaN }),
  };
  const { rerender } = render(<MarkdownCell field={field} rowIdx={0} disableSanitizeHtml />);
  expect(screen.getByRole('textbox', { name: 'Custom input' })).toHaveValue('Original');
  expect(screen.getByRole('status', { name: 'Tip' })).toContainElement(screen.getByRole('textbox'));
  field.values[0] = '> [!WARNING]\n> Updated';
  rerender(<MarkdownCell field={field} rowIdx={0} disableSanitizeHtml />);
  expect(screen.getByRole('alert', { name: 'Warning' })).toHaveTextContent('Updated');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
