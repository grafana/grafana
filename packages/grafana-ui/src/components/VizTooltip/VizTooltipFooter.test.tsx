import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { Field, FieldType, LinkModel } from '@grafana/data';

import { VizTooltipFooter, AdHocFilterModel } from './VizTooltipFooter';

describe('VizTooltipFooter', () => {
  it('should fire onclick', async () => {
    const onClick = jest.fn();
    const field: Field = {
      name: '',
      type: FieldType.string,
      values: [],
      config: {},
    };

    const link: LinkModel<Field> = {
      href: '#',
      onClick,
      title: '',
      origin: field,
      target: undefined,
    };

    render(
      <MemoryRouter>
        <VizTooltipFooter dataLinks={[link]} />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('link'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should render ad hoc filter button and fire onclick', async () => {
    const onFilterClick = jest.fn();
    const adHocFilter: AdHocFilterModel = {
      key: 'testKey',
      operator: '=',
      value: 'testValue',
      onClick: onFilterClick,
    };

    render(
      <MemoryRouter>
        <VizTooltipFooter dataLinks={[]} adHocFilters={[adHocFilter]} />
      </MemoryRouter>
    );

    const filterButton = screen.getByRole('button', { name: /filter for 'testValue'/i });
    expect(filterButton).toBeInTheDocument();

    await userEvent.click(filterButton);
    expect(onFilterClick).toHaveBeenCalled();
  });

  it('should not render ad hoc filter button when there are one-click links', () => {
    const onFilterClick = jest.fn();
    const onClick = jest.fn();
    const field: Field = {
      name: '',
      type: FieldType.string,
      values: [],
      config: {},
    };

    const oneClickLink: LinkModel<Field> = {
      href: '#',
      onClick,
      title: 'One Click Link',
      origin: field,
      target: undefined,
      oneClick: true,
    };

    const adHocFilter: AdHocFilterModel = {
      key: 'testKey',
      operator: '=',
      value: 'testValue',
      onClick: onFilterClick,
    };

    render(
      <MemoryRouter>
        <VizTooltipFooter dataLinks={[oneClickLink]} adHocFilters={[adHocFilter]} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /filter for 'testValue'/i })).not.toBeInTheDocument();
  });
});
