import { render, screen } from '@testing-library/react';

import { type Field, type LinkModel } from '@grafana/data';

import { FieldLinkList } from './FieldLinkList';

function makeLink(overrides?: Partial<LinkModel<Field>>): LinkModel<Field> {
  return {
    href: '/link',
    title: 'Link',
    target: '_self',
    origin: {} as Field,
    ...overrides,
  };
}

describe('FieldLinkList', () => {
  it('renders a single DataLinkButton when there is one link', () => {
    render(<FieldLinkList links={[makeLink({ title: 'Only Link' })]} />);

    expect(screen.getByText('Only Link')).toBeInTheDocument();
    expect(screen.queryByText('External links')).not.toBeInTheDocument();
  });

  it('separates internal and external links when there are multiple', () => {
    render(
      <FieldLinkList
        links={[
          makeLink({ title: 'Internal' }),
          makeLink({ title: 'External', target: '_blank', href: 'https://grafana.com' }),
        ]}
      />
    );

    expect(screen.getByText('Internal')).toBeInTheDocument();
    expect(screen.getByText('External links')).toBeInTheDocument();

    const extLink = screen.getByText('External').closest('a');
    expect(extLink).toHaveAttribute('target', '_blank');
    expect(extLink).toHaveAttribute('href', 'https://grafana.com');
  });
});
