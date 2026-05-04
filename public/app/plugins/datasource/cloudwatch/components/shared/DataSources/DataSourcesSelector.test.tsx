import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type ResourceResponse, type LogDataSourceResponse } from '../../../resources/types';

import { DataSourcesSelector } from './DataSourcesSelector';

const defaultDataSources: Array<ResourceResponse<LogDataSourceResponse>> = [
  { value: { name: 'amazon_vpc', type: 'flow' } },
  { value: { name: 'amazon_eks', type: 'audit' } },
];

const defaultProps = {
  selectedDataSources: [],
  fetchDataSources: () => Promise.resolve(defaultDataSources),
  onChange: jest.fn(),
};

describe('DataSourcesSelector', () => {
  it('loads data sources when the modal opens', async () => {
    const fetchDataSources = jest.fn().mockResolvedValue(defaultDataSources);
    render(<DataSourcesSelector {...defaultProps} fetchDataSources={fetchDataSources} />);

    await userEvent.click(screen.getByText('Select data sources'));

    await waitFor(() =>
      expect(fetchDataSources).toHaveBeenCalledWith({
        pattern: '',
      })
    );
    expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument();
    expect(screen.getByLabelText('amazon_eks.audit')).toBeInTheDocument();
  });

  it('selects all listed data sources when bulk action is used', async () => {
    const onChange = jest.fn();
    render(<DataSourcesSelector {...defaultProps} onChange={onChange} />);

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    await userEvent.click(selectListedCheckbox);
    expect(screen.getByText('2 data sources selected')).toBeInTheDocument();
    expect(selectListedCheckbox).toBeChecked();

    await userEvent.click(screen.getByText('Add data sources'));
    expect(onChange).toHaveBeenCalledWith([
      { name: 'amazon_vpc', type: 'flow' },
      { name: 'amazon_eks', type: 'audit' },
    ]);
  });

  it('clears listed selections when select-listed checkbox is unchecked', async () => {
    render(<DataSourcesSelector {...defaultProps} onChange={jest.fn()} />);

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    const firstRowCheckbox = screen.getByLabelText('amazon_vpc.flow') as HTMLInputElement;
    const secondRowCheckbox = screen.getByLabelText('amazon_eks.audit') as HTMLInputElement;

    await userEvent.click(selectListedCheckbox);
    expect(selectListedCheckbox).toBeChecked();
    expect(firstRowCheckbox).toBeChecked();
    expect(secondRowCheckbox).toBeChecked();

    await userEvent.click(selectListedCheckbox);
    expect(selectListedCheckbox).not.toBeChecked();
    expect(firstRowCheckbox).not.toBeChecked();
    expect(secondRowCheckbox).not.toBeChecked();
    expect(screen.getByText('0 data sources selected')).toBeInTheDocument();
  });

  it('clears all selected data sources when bulk checkbox is unchecked', async () => {
    render(
      <DataSourcesSelector
        {...defaultProps}
        selectedDataSources={[
          { name: 'amazon_vpc', type: 'flow' },
          { name: 'amazon_eks', type: 'audit' },
          { name: 'hidden_ds', type: 'logs' },
        ]}
      />
    );

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    expect(selectListedCheckbox).toBeChecked();
    expect(screen.getByText('3 data sources selected')).toBeInTheDocument();

    await userEvent.click(selectListedCheckbox);
    expect(selectListedCheckbox).not.toBeChecked();
    expect(screen.getByText('0 data sources selected')).toBeInTheDocument();
  });

  it('caps bulk selection at 10 and shows an error', async () => {
    const onChange = jest.fn();
    const listedDataSources: Array<ResourceResponse<LogDataSourceResponse>> = [
      { value: { name: 'ds1', type: 'type1' } },
      { value: { name: 'ds2', type: 'type2' } },
      { value: { name: 'ds3', type: 'type3' } },
    ];

    render(
      <DataSourcesSelector
        {...defaultProps}
        onChange={onChange}
        fetchDataSources={() => Promise.resolve(listedDataSources)}
        selectedDataSources={[
          { name: 'already1', type: 'type1' },
          { name: 'already2', type: 'type2' },
          { name: 'already3', type: 'type3' },
          { name: 'already4', type: 'type4' },
          { name: 'already5', type: 'type5' },
          { name: 'already6', type: 'type6' },
          { name: 'already7', type: 'type7' },
          { name: 'already8', type: 'type8' },
          { name: 'already9', type: 'type9' },
        ]}
      />
    );

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('ds1.type1')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    await userEvent.click(selectListedCheckbox);
    expect(screen.getByText('10 data sources selected')).toBeInTheDocument();
    expect(
      screen.getByText('Only 1 listed data source was added. You can select up to 10 data sources.')
    ).toBeInTheDocument();
    expect(selectListedCheckbox.indeterminate).toBe(true);

    await userEvent.click(screen.getByText('Add data sources'));
    expect(onChange).toHaveBeenCalledWith([
      { name: 'already1', type: 'type1' },
      { name: 'already2', type: 'type2' },
      { name: 'already3', type: 'type3' },
      { name: 'already4', type: 'type4' },
      { name: 'already5', type: 'type5' },
      { name: 'already6', type: 'type6' },
      { name: 'already7', type: 'type7' },
      { name: 'already8', type: 'type8' },
      { name: 'already9', type: 'type9' },
      { name: 'ds1', type: 'type1' },
    ]);
  });

  it('clears the selection limit warning when a selected data source is removed', async () => {
    render(
      <DataSourcesSelector
        {...defaultProps}
        fetchDataSources={() =>
          Promise.resolve([
            { value: { name: 'ds1', type: 'type1' } },
            { value: { name: 'ds2', type: 'type2' } },
            { value: { name: 'ds3', type: 'type3' } },
          ])
        }
        selectedDataSources={Array.from({ length: 9 }, (_, index) => ({
          name: `already${index + 1}`,
          type: `type${index + 1}`,
        }))}
      />
    );

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('ds1.type1')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Select listed data sources'));
    expect(
      screen.getByText('Only 1 listed data source was added. You can select up to 10 data sources.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select listed data sources'));
    expect(
      screen.queryByText('Only 1 listed data source was added. You can select up to 10 data sources.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('0 data sources selected')).toBeInTheDocument();
  });

  it('shows indeterminate select-listed state when some listed data sources are selected', async () => {
    render(<DataSourcesSelector {...defaultProps} selectedDataSources={[{ name: 'amazon_vpc', type: 'flow' }]} />);

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    expect(selectListedCheckbox).not.toBeChecked();
    expect(selectListedCheckbox.indeterminate).toBe(true);
  });

  it('clears selected data sources when bulk checkbox is clicked in indeterminate state', async () => {
    render(<DataSourcesSelector {...defaultProps} selectedDataSources={[{ name: 'amazon_vpc', type: 'flow' }]} />);

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    const selectListedCheckbox = screen.getByLabelText('Select listed data sources') as HTMLInputElement;
    expect(selectListedCheckbox.indeterminate).toBe(true);

    await userEvent.click(selectListedCheckbox);
    expect(selectListedCheckbox).not.toBeChecked();
    expect(selectListedCheckbox.indeterminate).toBe(false);
    expect(screen.getByText('0 data sources selected')).toBeInTheDocument();
  });

  it('restores the saved selection when the modal is cancelled', async () => {
    const onChange = jest.fn();
    render(
      <DataSourcesSelector
        {...defaultProps}
        onChange={onChange}
        selectedDataSources={[{ name: 'amazon_vpc', type: 'flow' }]}
      />
    );

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_vpc.flow')).toBeInTheDocument());

    expect(screen.getByLabelText('amazon_vpc.flow') as HTMLInputElement).toBeChecked();
    expect(screen.getByLabelText('amazon_eks.audit') as HTMLInputElement).not.toBeChecked();

    await userEvent.click(screen.getByLabelText('amazon_eks.audit'));
    expect(screen.getByText('2 data sources selected')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Cancel'));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Select data sources'));
    await waitFor(() => expect(screen.getByLabelText('amazon_eks.audit')).toBeInTheDocument());

    expect(screen.getByLabelText('amazon_vpc.flow') as HTMLInputElement).toBeChecked();
    expect(screen.getByLabelText('amazon_eks.audit') as HTMLInputElement).not.toBeChecked();
    expect(screen.getByText('1 data source selected')).toBeInTheDocument();
  });
});
