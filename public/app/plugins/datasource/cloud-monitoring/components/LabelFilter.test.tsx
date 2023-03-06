import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { LabelFilter } from './LabelFilter';

const labels = {
  'metric.label.instance_name': ['instance_name_1', 'instance_name_2'],
  'resource.label.instance_id': ['instance_id_1', 'instance_id_2'],
  'resource.label.project_id': ['project_id_1', 'project_id_2'],
  'resource.label.zone': ['zone_1', 'zone_2'],
  'resource.type': ['type_1', 'type_2'],
};

describe('LabelFilter', () => {
  it('should render an add button with no filters passed in', () => {
    render(<LabelFilter labels={{}} filters={[]} onChange={() => {}} variableOptionGroup={[]} />);
    expect(screen.getByLabelText('Add')).toBeInTheDocument();
  });

  it('should render filters if any are passed in', () => {
    const filters = ['key_1', '=', 'value_1'];
    render(<LabelFilter labels={{}} filters={filters} onChange={() => {}} variableOptionGroup={[]} />);
    expect(screen.getByText('key_1')).toBeInTheDocument();
    expect(screen.getByText('value_1')).toBeInTheDocument();
  });

  it('should render skip "protected" filters', () => {
    const filters = ['metric.type', '=', 'value_1'];
    render(<LabelFilter labels={{}} filters={filters} onChange={() => {}} variableOptionGroup={[]} />);
    expect(screen.queryByText('metric.type')).not.toBeInTheDocument();
    expect(screen.queryByText('value_1')).not.toBeInTheDocument();
  });

  it('can add filters', async () => {
    const onChange = jest.fn();
    render(<LabelFilter labels={{}} filters={[]} onChange={onChange} variableOptionGroup={[]} />);
    await userEvent.click(screen.getByLabelText('Add'));
    expect(onChange).toBeCalledWith(expect.arrayContaining(['', '=', '']));
  });

  it('should render grouped labels', async () => {
    const filters = ['key_1', '=', 'value_1'];
    render(<LabelFilter labels={labels} filters={filters} onChange={() => {}} variableOptionGroup={[]} />);

    await openMenu(screen.getByLabelText('Filter label key'));

    expect(screen.getByText('Metric Label')).toBeInTheDocument();
    expect(screen.getByText('metric.label.instance_name')).toBeInTheDocument();

    expect(screen.getByText('Resource Label')).toBeInTheDocument();
    expect(screen.getByText('resource.label.instance_id')).toBeInTheDocument();
    expect(screen.getByText('resource.label.project_id')).toBeInTheDocument();
    expect(screen.getByText('resource.label.zone')).toBeInTheDocument();

    expect(screen.getByText('Resource Type')).toBeInTheDocument();
    expect(screen.getByText('resource.type')).toBeInTheDocument();
  });

  it('can select a label key to filter on', async () => {
    const onChange = jest.fn();
    const filters = ['key_1', '=', ''];
    render(<LabelFilter labels={labels} filters={filters} onChange={onChange} variableOptionGroup={[]} />);

    const key = screen.getByLabelText('Filter label key');
    await select(key, 'metric.label.instance_name', { container: document.body });

    expect(onChange).toBeCalledWith(expect.arrayContaining(['metric.label.instance_name', '=', '']));
  });

  it('should on render label values for the selected filter key', async () => {
    const filters = ['metric.label.instance_name', '=', ''];
    render(<LabelFilter labels={labels} filters={filters} onChange={() => {}} variableOptionGroup={[]} />);

    await openMenu(screen.getByLabelText('Filter label value'));
    expect(screen.getByText('instance_name_1')).toBeInTheDocument();
    expect(screen.getByText('instance_name_2')).toBeInTheDocument();
    expect(screen.queryByText('instance_id_1')).not.toBeInTheDocument();
    expect(screen.queryByText('instance_id_2')).not.toBeInTheDocument();
    expect(screen.queryByText('project_id_1')).not.toBeInTheDocument();
    expect(screen.queryByText('project_id_2')).not.toBeInTheDocument();
    expect(screen.queryByText('zone_1')).not.toBeInTheDocument();
    expect(screen.queryByText('zone_2')).not.toBeInTheDocument();
    expect(screen.queryByText('type_1')).not.toBeInTheDocument();
    expect(screen.queryByText('type_2')).not.toBeInTheDocument();
  });

  it('can select a label value to filter on', async () => {
    const onChange = jest.fn();
    const filters = ['metric.label.instance_name', '=', ''];
    render(<LabelFilter labels={labels} filters={filters} onChange={onChange} variableOptionGroup={[]} />);

    const key = screen.getByLabelText('Filter label value');
    await select(key, 'instance_name_1', { container: document.body });

    expect(onChange).toBeCalledWith(expect.arrayContaining(['metric.label.instance_name', '=', 'instance_name_1']));
  });
});
