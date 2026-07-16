import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AccordionCategorizedKeyValues from './AccordionCategorizedKeyValues';

const tags = [
  { key: 'http.method', value: 'POST' },
  { key: 'http.status_code', value: '204' },
  { key: 'service.name', value: 'api' },
];

describe('AccordionCategorizedKeyValues', () => {
  it('renders categorized attribute sections when expanded', () => {
    render(
      <AccordionCategorizedKeyValues
        data={tags}
        sectionType="span"
        isOpen={true}
        label="Span attributes"
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByTestId('attribute-category-http')).toBeInTheDocument();
    expect(screen.getByText('HTTP')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'http.method' })).toBeInTheDocument();
  });

  it('hides categories when collapsed', () => {
    render(
      <AccordionCategorizedKeyValues
        data={tags}
        sectionType="span"
        isOpen={false}
        label="Span attributes"
        onToggle={jest.fn()}
      />
    );

    expect(screen.queryByTestId('attribute-category-http')).not.toBeInTheDocument();
    expect(screen.getByText('http.method')).toBeInTheDocument();
  });

  it('calls onToggle when the header is clicked', async () => {
    const onToggle = jest.fn();

    render(
      <AccordionCategorizedKeyValues
        data={tags}
        sectionType="resource"
        isOpen={false}
        label="Resource attributes"
        onToggle={onToggle}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: /Resource attributes/ }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggles category sections open and closed', async () => {
    render(
      <AccordionCategorizedKeyValues
        data={tags}
        sectionType="span"
        isOpen={true}
        label="Span attributes"
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByRole('cell', { name: 'http.method' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /HTTP/ }));

    expect(screen.queryByRole('cell', { name: 'http.method' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /HTTP/ }));

    expect(screen.getByRole('cell', { name: 'http.method' })).toBeInTheDocument();
  });

  it('renders uncategorized attributes flat without an Other section', () => {
    render(
      <AccordionCategorizedKeyValues
        data={[
          { key: 'custom.field', value: 'value' },
          { key: 'another.custom', value: 'other' },
        ]}
        sectionType="span"
        isOpen={true}
        label="Span attributes"
        onToggle={jest.fn()}
      />
    );

    expect(screen.queryByTestId('attribute-category-other')).not.toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'custom.field' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'another.custom' })).toBeInTheDocument();
  });

  it('still shows Other when mixed with named categories', () => {
    render(
      <AccordionCategorizedKeyValues
        data={[
          { key: 'http.method', value: 'GET' },
          { key: 'custom.field', value: 'value' },
        ]}
        sectionType="span"
        isOpen={true}
        label="Span attributes"
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByTestId('attribute-category-http')).toBeInTheDocument();
    expect(screen.getByTestId('attribute-category-other')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});
