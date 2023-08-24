import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { TestProvider } from '../../../../../../scripts/grafana-server/tmp/public/test/helpers/TestProvider';

import { RowOptionsForm } from './RowOptionsForm';

jest.mock('../RepeatRowSelect/RepeatRowSelect', () => ({
  RepeatRowSelect: () => <div />,
}));
describe('DashboardRow', () => {
  it('Should show warning component when has warningMessage prop', () => {
    render(
      <TestProvider>
        <RowOptionsForm
          repeat={'3'}
          title=""
          onCancel={jest.fn()}
          onUpdate={jest.fn()}
          warningMessage="a warning message"
        />
      </TestProvider>
    );
    expect(
      screen.getByTestId(selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage)
    ).toBeInTheDocument();
  });

  it('Should not show warning component when does not have warningMessage prop', () => {
    render(
      <TestProvider>
        <RowOptionsForm repeat={'3'} title="" onCancel={jest.fn()} onUpdate={jest.fn()} />
      </TestProvider>
    );
    expect(
      screen.queryByTestId(selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage)
    ).not.toBeInTheDocument();
  });
});
