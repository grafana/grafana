import { render, screen } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { CoreApp } from '@grafana/data';

import { PromQuery } from '../../types';
import { getQueryWithDefaults } from '../state';

import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';

describe('PromQueryBuilderOptions', () => {
  it('Can change query type', async () => {
    const { props } = setup();

    screen.getByTitle('Click to edit options').click();
    expect(screen.getByLabelText('Range')).toBeChecked();

    screen.getByLabelText('Instant').click();

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      instant: true,
      range: false,
      exemplar: false,
    });
  });

  it('Can set query type to "Both" on render for PanelEditor', async () => {
    setup({ instant: true, range: true });

    screen.getByTitle('Click to edit options').click();

    expect(screen.getByLabelText('Both')).toBeChecked();
  });

  it('Can set query type to "Both" on render for Explorer', async () => {
    setup({ instant: true, range: true }, CoreApp.Explore);

    screen.getByTitle('Click to edit options').click();

    expect(screen.getByLabelText('Both')).toBeChecked();
  });

  it('Legend format default to Auto', async () => {
    setup();
    expect(screen.getByText('Legend: Auto')).toBeInTheDocument();
  });

  it('Can change legend format to verbose', async () => {
    const { props } = setup();

    screen.getByTitle('Click to edit options').click();

    let legendModeSelect = screen.getByText('Auto').parentElement!;
    legendModeSelect.click();

    await selectOptionInTest(legendModeSelect as HTMLElement, 'Verbose');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      legendFormat: '',
    });
  });

  it('Can change legend format to custom', async () => {
    const { props } = setup();

    screen.getByTitle('Click to edit options').click();

    let legendModeSelect = screen.getByText('Auto').parentElement!;
    legendModeSelect.click();

    await selectOptionInTest(legendModeSelect as HTMLElement, 'Custom');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      legendFormat: '{{label_name}}',
    });
  });

  it('Handle defaults with undefined range', async () => {
    setup(getQueryWithDefaults({ refId: 'A', expr: '', range: undefined, instant: true }, CoreApp.Dashboard));

    expect(screen.getByText('Type: Instant')).toBeInTheDocument();
  });

  it('Should show "Exemplars: false" by default', async () => {
    setup();
    expect(screen.getByText('Exemplars: false')).toBeInTheDocument();
  });

  it('Should show "Exemplars: false" when query has "Exemplars: false"', async () => {
    setup({ exemplar: false });
    expect(screen.getByText('Exemplars: false')).toBeInTheDocument();
  });

  it('Should show "Exemplars: true" when query has "Exemplars: true"', async () => {
    setup({ exemplar: true });
    expect(screen.getByText('Exemplars: true')).toBeInTheDocument();
  });
});

function setup(queryOverrides: Partial<PromQuery> = {}, app: CoreApp = CoreApp.PanelEditor) {
  const props = {
    app,
    query: {
      ...getQueryWithDefaults({ refId: 'A' } as PromQuery, CoreApp.PanelEditor),
      ...queryOverrides,
    },
    onRunQuery: jest.fn(),
    onChange: jest.fn(),
    uiOptions: {
      exemplars: true,
      type: true,
      format: true,
      minStep: true,
      legend: true,
      resolution: true,
    },
  };

  const { container } = render(<PromQueryBuilderOptions {...props} />);
  return { container, props };
}
