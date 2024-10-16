import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { Field, FieldType, LinkModel } from '@grafana/data';

import { userEvent } from '../../../../../public/test/test-utils';

import { VizTooltipFooter } from './VizTooltipFooter';

describe('VizTooltipFooter', () => {
  let windowSpy: jest.SpyInstance;

  beforeAll(() => {
    windowSpy = jest.spyOn(window, 'location', 'get');
    windowSpy.mockImplementation(() => ({
      origin: 'http://www.grafana.com',
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

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
    screen.getByRole('link');
    expect(onClick).toHaveBeenCalled();
  });
});
