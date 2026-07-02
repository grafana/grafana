import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';

import { LogsManagement } from './LogsManagement';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('LogsQueryEditor.LogsManagement', () => {
  describe('radio option visibility', () => {
    it('renders only Analytics when neither toggle is enabled', () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
        />
      );

      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
      expect(screen.queryByLabelText('Basic')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Auxiliary')).not.toBeInTheDocument();
    });

    it('renders Analytics + Basic when only basicLogsEnabled', () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
      expect(screen.getByLabelText('Basic')).toBeInTheDocument();
      expect(screen.queryByLabelText('Auxiliary')).not.toBeInTheDocument();
    });

    it('renders Analytics + Auxiliary when only auxiliaryLogsEnabled', () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
          auxiliaryLogsEnabled={true}
        />
      );

      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
      expect(screen.queryByLabelText('Basic')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Auxiliary')).toBeInTheDocument();
    });

    it('renders all three options when both toggles enabled', () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
      expect(screen.getByLabelText('Basic')).toBeInTheDocument();
      expect(screen.getByLabelText('Auxiliary')).toBeInTheDocument();
    });
  });

  describe('Basic selection', () => {
    it('shows Basic Logs modal and sets logTier=Basic on confirm', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Basic'));

      expect(await screen.findByText('Basic Logs Queries')).toBeInTheDocument();
      await userEvent.click(await screen.findByText('Confirm'));

      expect(onChange).toBeCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Basic',
            query: '',
            dashboardTime: true,
          }),
        })
      );
    });

    it('clears the existing kusto query when switching to Basic', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: { basicLogsQuery: undefined, query: 'table | my test query' },
      });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Basic'));
      await userEvent.click(await screen.findByText('Confirm'));

      expect(onChange).toBeCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Basic',
            query: '',
            dashboardTime: true,
          }),
        })
      );
    });
  });

  describe('Auxiliary selection', () => {
    it('shows Auxiliary Logs modal with SLA warning and sets logTier=Auxiliary on confirm', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          auxiliaryLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Auxiliary'));

      expect(await screen.findByText('Auxiliary Logs Queries')).toBeInTheDocument();
      expect(await screen.findByText(/no response time SLAs/)).toBeInTheDocument();

      await userEvent.click(await screen.findByText('Confirm'));

      expect(onChange).toBeCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: true,
            logTier: 'Auxiliary',
            query: '',
            dashboardTime: true,
          }),
        })
      );
    });

    it('shows the Auxiliary modal (not Basic) when switching from Basic to Auxiliary', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: { basicLogsQuery: true, logTier: 'Basic' },
      });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Auxiliary'));

      expect(await screen.findByText('Auxiliary Logs Queries')).toBeInTheDocument();
      expect(screen.queryByText('Basic Logs Queries')).not.toBeInTheDocument();
    });
  });

  describe('Analytics selection', () => {
    it('clears basicLogsQuery and logTier when Analytics is clicked', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: { basicLogsQuery: true, logTier: 'Basic' },
      });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Analytics'));

      expect(onChange).toBeCalledWith(
        expect.objectContaining({
          azureLogAnalytics: expect.objectContaining({
            basicLogsQuery: false,
            logTier: undefined,
            query: '',
          }),
        })
      );
    });
  });

  describe('modal dismiss', () => {
    it('does not mutate the query when the Basic modal is dismissed', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          basicLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Basic'));
      expect(await screen.findByText('Basic Logs Queries')).toBeInTheDocument();
      await userEvent.click(await screen.findByText('Cancel'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not mutate the query when the Auxiliary modal is dismissed', async () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({ azureLogAnalytics: { basicLogsQuery: undefined } });
      const onChange = jest.fn();

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={() => {}}
          auxiliaryLogsEnabled={true}
        />
      );

      await userEvent.click(await screen.findByLabelText('Auxiliary'));
      expect(await screen.findByText('Auxiliary Logs Queries')).toBeInTheDocument();
      await userEvent.click(await screen.findByText('Cancel'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('legacy queries (basicLogsQuery=true with no logTier)', () => {
    it('renders with the Basic option selected', () => {
      const mockDatasource = createMockDatasource();
      const query = createMockQuery({
        azureLogAnalytics: { basicLogsQuery: true, logTier: undefined },
      });

      render(
        <LogsManagement
          query={query}
          datasource={mockDatasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={jest.fn()}
          setError={() => {}}
          basicLogsEnabled={true}
          auxiliaryLogsEnabled={true}
        />
      );

      expect(screen.getByLabelText('Basic')).toBeChecked();
      expect(screen.getByLabelText('Analytics')).not.toBeChecked();
      expect(screen.getByLabelText('Auxiliary')).not.toBeChecked();
    });
  });
});
