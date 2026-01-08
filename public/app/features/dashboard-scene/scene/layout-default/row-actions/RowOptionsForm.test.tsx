import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';

import { DashboardScene } from '../../DashboardScene';

import { RowOptionsForm } from './RowOptionsForm';

jest.mock('app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect', () => ({
  RepeatRowSelect2: () => <div />,
}));

describe('DashboardRow', () => {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
  });

  it('Should show warning component when has warningMessage prop', () => {
    render(
      <TestProvider>
        <RowOptionsForm
          repeat={'3'}
          sceneContext={scene}
          title=""
          onCancel={jest.fn()}
          onUpdate={jest.fn()}
          isUsingDashboardDS={true}
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
        <RowOptionsForm
          repeat={'3'}
          sceneContext={scene}
          title=""
          onCancel={jest.fn()}
          onUpdate={jest.fn()}
          isUsingDashboardDS={false}
        />
      </TestProvider>
    );
    expect(
      screen.queryByTestId(selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage)
    ).not.toBeInTheDocument();
  });
});
