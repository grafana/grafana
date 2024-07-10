import { render, screen, within } from '@testing-library/react';
import { byRole } from 'testing-library-selector';

import { SectionsDto } from '../irmHooks';

import { Essentials } from './Essentials';

function mockSectionsDto(): SectionsDto {
  return {
    sections: [
      {
        title: 'Detect',
        description: 'Configure something1',
        steps: [
          {
            title: 'Create something1',
            description: 'description1',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/url1',
              },
              label: 'label1',
            },
            done: true,
          },
          {
            title: 'Create something2',
            description: 'description2',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/url2',
              },
              label: 'label2',
            },
            done: false,
          },
          {
            title: 'testing step',
            description: 'description3',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/url3',
              },
              label: 'label3',
            },
          },
          {
            title: 'testing step',
            description: 'description3',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/url4',
              },
              urlLinkOnDone: {
                url: '/url4',
              },
              label: 'testNotDone',
              labelOnDone: 'testDone',
            },
            done: true,
          },
        ],
      },
    ],
  };
}
describe('Essentials', () => {
  it('renders progress status correctly', async () => {
    const essentialsConfig = mockSectionsDto();
    const stepsDone = 2;
    const totalStepsToDo = 5;
    render(
      <Essentials
        essentialsConfig={essentialsConfig}
        stepsDone={stepsDone}
        totalStepsToDo={totalStepsToDo}
        onClose={jest.fn()}
      />
    );
    const progressBar = screen.getByText(/your progress/i);
    expect(within(progressBar).getByText(/2/i)).toBeInTheDocument();
    expect(within(progressBar).getByText(/of 5/i)).toBeInTheDocument();
  });
  it('renders steps correctly', async () => {
    const essentialsConfig = mockSectionsDto();
    const stepsDone = 0;
    const totalStepsToDo = 5;
    render(
      <Essentials
        essentialsConfig={essentialsConfig}
        stepsDone={stepsDone}
        totalStepsToDo={totalStepsToDo}
        onClose={jest.fn()}
      />
    );
    // step1 is done and labelonDone is not defined
    expect(byRole('heading', { name: /detect/i }).get()).toBeInTheDocument();
    const step1 = screen.getAllByTestId('step')[0];
    expect(within(step1).getByText(/create something1/i)).toBeInTheDocument();
    expect(within(step1).getByTestId('checked-step')).toBeInTheDocument();
    expect(within(step1).queryByRole('link', { name: /label1/i })).not.toBeInTheDocument();
    // step2 is not done
    const step2 = screen.getAllByTestId('step')[1];
    expect(within(step2).getByText(/create something2/i)).toBeInTheDocument();
    expect(within(step2).getByTestId('unckecked-step')).toBeInTheDocument();
    expect(byRole('link', { name: /label2/i }).get()).toBeInTheDocument();

    // step3 , done is not defined
    const step3 = screen.getAllByTestId('step')[2];
    expect(within(step3).getByText(/testing step/i)).toBeInTheDocument();
    expect(within(step3).queryByTestId('checked-step')).not.toBeInTheDocument();
    expect(within(step3).queryByTestId('unckecked-step')).not.toBeInTheDocument();
    expect(within(step3).queryByTestId('step-button')).not.toBeInTheDocument();
    expect(within(step3).queryByRole('link', { name: /label3/i })).toBeInTheDocument();

    // step4 is done and labelonDone is defined
    const step4 = screen.getAllByTestId('step')[3];
    expect(within(step4).getByText(/testing step/i)).toBeInTheDocument();
    expect(within(step4).getByTestId('checked-step')).toBeInTheDocument();
    expect(within(step4).queryByRole('link', { name: /testNotDone/i })).not.toBeInTheDocument();
    expect(within(step4).queryByRole('link', { name: /testDone/i })).toBeInTheDocument();
  });
});
