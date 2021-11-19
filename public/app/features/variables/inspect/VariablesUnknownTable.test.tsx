import React from 'react';
import * as runtime from '@grafana/runtime';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariablesUnknownTable, VariablesUnknownTableProps } from './VariablesUnknownTable';
import { customBuilder } from '../shared/testing/builders';
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
    it('then it should show loading spinner', async () => {
      await getTestContext();

      userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
      await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
    });

    it('then it should call getUnknownsNetwork', async () => {
      const { getUnknownsNetworkSpy } = await getTestContext();

      userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
      await waitFor(() => expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1));
    });

    it('then it should report the interaction', async () => {
      const { reportInteractionSpy } = await getTestContext();

      userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
      await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());

      expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
      expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
    });

    describe('but when expanding it again without changes to variables or dashboard', () => {
      it('then it should not call getUnknownsNetwork', async () => {
        const { getUnknownsNetworkSpy } = await getTestContext();

        userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByTitle('Click to collapse')).toBeInTheDocument());
        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByTitle('Click to expand')).toBeInTheDocument());

        userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitFor(() => expect(screen.getByTitle('Click to collapse')).toBeInTheDocument());

        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('and there are no renamed or missing variables', () => {
      it('then it should render the correct message', async () => {
        await getTestContext();

        userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitForElementToBeRemoved(() => screen.getByText('Loading...'));

        expect(screen.getByText('No renamed or missing variables found.')).toBeInTheDocument();
      });
    });

    describe('and there are renamed or missing variables', () => {
      it('then it should render the table', async () => {
        const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
        const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
        const { reportInteractionSpy } = await getTestContext({}, usages);

        userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
        await waitForElementToBeRemoved(() => screen.getByText('Loading...'));

        expect(screen.queryByText('No renamed or missing variables found.')).not.toBeInTheDocument();
        expect(screen.getByText('Renamed Variable')).toBeInTheDocument();
        expect(screen.getAllByTestId('VariablesUnknownButton')).toHaveLength(1);

        // make sure we don't report the interaction for slow expansion
        expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
        expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
      });

      describe('but when the unknown processing takes a while', () => {
        const origDateNow = Date.now;

        afterEach(() => {
          Date.now = origDateNow;
        });

        it('then it should report slow expansion', async () => {
          const variable = customBuilder().withId('Renamed Variable').withName('Renamed Variable').build();
          const usages = [{ variable, nodes: [], edges: [], showGraph: false }];
          const { reportInteractionSpy } = await getTestContext({}, usages);
          const dateNowStart = 1000;
          const dateNowStop = 2000;
          Date.now = jest.fn().mockReturnValueOnce(dateNowStart).mockReturnValue(dateNowStop);

          userEvent.click(screen.getByRole('heading', { name: /renamed or missing variables/i }));
          await waitForElementToBeRemoved(() => screen.getByText('Loading...'));

          // make sure we report the interaction for slow expansion
          expect(reportInteractionSpy).toHaveBeenCalledTimes(2);
          expect(reportInteractionSpy.mock.calls[0][0]).toEqual('Unknown variables section expanded');
          expect(reportInteractionSpy.mock.calls[1][0]).toEqual('Slow unknown variables expansion');
          expect(reportInteractionSpy.mock.calls[1][1]).toEqual({ elapsed: 1000 });
        });
      });
    });
  });
});
