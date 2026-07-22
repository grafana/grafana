import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as runtime from '@grafana/runtime';

import { VariablesUnknownTable, type VariablesUnknownTableProps } from './VariablesUnknownTable';
import { type UsagesToNetwork } from './types';
import * as utils from './utils';

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
  await waitFor(() => expect(screen.getByLabelText('Renamed or missing variables')).toBeInTheDocument());

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

      await userEvent.click(screen.getByLabelText('Renamed or missing variables'));
      await waitFor(() => expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1));
    });

    it('then it should report the interaction', async () => {
      const { reportInteractionSpy } = await getTestContext();

      await userEvent.click(screen.getByLabelText('Renamed or missing variables'));

      expect(reportInteractionSpy).toHaveBeenCalledTimes(1);
      expect(reportInteractionSpy).toHaveBeenCalledWith('Unknown variables section expanded');
    });

    describe('but when expanding it again without changes to variables or dashboard', () => {
      it('then it should not call getUnknownsNetwork', async () => {
        const { getUnknownsNetworkSpy } = await getTestContext();

        await userEvent.click(screen.getByLabelText('Renamed or missing variables'));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));
        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByLabelText('Renamed or missing variables'));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false'));

        await userEvent.click(screen.getByLabelText('Renamed or missing variables'));
        await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true'));

        expect(getUnknownsNetworkSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('and there are no renamed or missing variables', () => {
      it('then it should render the correct message', async () => {
        await getTestContext();

        await userEvent.click(screen.getByLabelText('Renamed or missing variables'));

        await waitFor(() => expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument());
        expect(screen.getByText('No renamed or missing variables found.')).toBeInTheDocument();
      });
    });

    describe('and there are renamed or missing variables', () => {
      it('then it should render the table', async () => {
        await userEvent.click(screen.getByLabelText('Renamed or missing variables'));

        expect(screen.queryByText('No renamed or missing variables found.')).not.toBeInTheDocument();
        expect(screen.getByText('Renamed Variable')).toBeInTheDocument();
        expect(screen.getAllByTestId('VariablesUnknownButton')).toHaveLength(1);
      });
    });
  });
});
