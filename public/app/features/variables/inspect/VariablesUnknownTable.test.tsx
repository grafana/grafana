import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import * as runtime from '@grafana/runtime';

import { customBuilder } from '../shared/testing/builders';

import {
  SLOW_VARIABLES_EXPANSION_THRESHOLD,
  VariablesUnknownTable,
  VariablesUnknownTableProps,
} from './VariablesUnknownTable';
import * as utils from './utils';
import { UsagesToNetwork } from './utils';

async function getTestContext(
  overrides: Partial<VariablesUnknownTableProps> | undefined = {},
  usages: UsagesToNetwork[] = []
) {
  jest.clearAllMocks();
  const reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction').mockImplementation();
  const getUnknownsNetworkSpy = jest.spyOn(utils, 'getUnknownsNetwork').mockResolvedValue(usages);
  const defaults: VariablesUnknownTableProps = {
    variables: [],
    dashboard: null,
  };
  const props = { ...defaults, ...overrides };
  const { rerender } = render(<VariablesUnknownTable {...props} />);
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: /renamed or missing variables/i })).toBeInTheDocument()
  );

  return { reportInteractionSpy, getUnknownsNetworkSpy, rerender };
}

describe('VariablesUnknownTable', () => {
  describe('when rendered', () => {
    it('then it should render the section header', async () => {
      await getTestContext();
    });
  });

  describe('when expanding the section', () => {
    it('then it should call getUnknownsNetwork', async () => {
      const { getUnknownsNetworkSpy } = await getTestContext();

      await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
      await waitFor(() => expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1));
    });

    it('then it should report the interaction', async () => {
      const { reportInteractionSpy } = await getTestContext();

      await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));

      expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
      expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
    });

    describe('but when expanding it again without changes to variables or dashboard', () => {
      it('then it should not call getUnknownsNetwork', async () => {
        const { getUnknownsNetworkSpy } = await getTestContext();

        await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));
        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false'));

        await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));

        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('and there are no renamed or missing variables', () => {
      it('then it should render the correct message', async () => {
        await getTestContext();

        await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));

        expect(screen.getByText('No renamed or missing variables found.')).toBeInTheDocument();
      });
    });

    describe('and there are renamed or missing variables', () => {
      it('then it should render the table', async () => {
        const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
        const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
        const { reportInteractionSpy } = await getTestContext({}, usages);

        await userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));

        expect(screen.queryByText('No renamed or missing variables found.')).not.toBeInTheDocument();
        expect(screen.getByText('Renamed Variable')).toBeInTheDocument();
        expect(screen.getAllByTestId('VariablesUnknownButton')).toHaveLength(1);

        // make sure we don't report the interaction for slow expansion
        expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
        expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
      });

      describe('but when the unknown processing takes a while', () => {
        let user: ReturnType<typeof userEvent.setup>;

        beforeEach(() => {
          jest.useFakeTimers();
          // Need to use delay: null here to work with fakeTimers
          // see https://github.com/testing-library/user-event/issues/833
          user = userEvent.setup({ delay: null });
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        it('then it should report slow expansion', async () => {
          const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
          const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
          const { getUnknownsNetworkSpy, reportInteractionSpy } = await getTestContext({}, usages);
          getUnknownsNetworkSpy.mockImplementation(() => {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(usages);
              }, SLOW_VARIABLES_EXPANSION_THRESHOLD);
            });
          });

          await user.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));

          jest.advanceTimersByTime(SLOW_VARIABLES_EXPANSION_THRESHOLD);

          // make sure we report the interaction for slow expansion
          await waitFor(() =>
            expect(reportInteractionSpy).toHaveBeenCalledWith('Slow unknown variables expansion', {
              elapsed: expect.any(Number),
            })
          );
        });
      });
    });
  });
});
