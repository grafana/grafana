import React from 'react';
import { shallow } from 'enzyme';
import { ElasticVariableQueryEditor } from './VariableQueryEditor';

const setup = async (propOverrides?: object) => {
  const props = {
    onChange: () => {},
    query: '',
    datasource: {
      getFields: async () => Promise.resolve([{ text: 'field', type: 'number' }]),
    },
    templateSrv: { variables: [{ name: 'test' }] },
    ...propOverrides,
  };

  const wrapper = await shallow(<ElasticVariableQueryEditor {...props} />);
  const instance = wrapper.instance() as ElasticVariableQueryEditor;

  return {
    wrapper,
    instance,
  };
};

describe('ElasticVariableQueryEditor', () => {
  it('should render component', async () => {
    const { wrapper } = await setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('when loading component should initialize state', async () => {
    const { instance } = await setup();
    await instance.componentDidMount();
    const { find, fields, initialQuery } = instance.state;
    expect(find).toBe('fields');
    expect(fields).toEqual([{ value: 'field', label: 'field', description: 'number' }]);
    expect(initialQuery).toEqual({});
  });

  it('when loading component with existing fields query should initialize state', async () => {
    const { instance } = await setup({
      query: JSON.stringify({ find: 'fields', type: 'keyword' }),
    });
    await instance.componentDidMount();
    const { find, initialQuery } = instance.state;
    expect(find).toBe('fields');
    expect(initialQuery).toEqual({
      find: 'fields',
      type: 'keyword',
    });
  });

  it('when loading component with existing terms query should initialize state', async () => {
    const { instance } = await setup({
      query: JSON.stringify({ find: 'terms', field: 'field' }),
    });
    await instance.componentDidMount();
    const { find, initialQuery } = instance.state;
    expect(find).toBe('terms');
    expect(initialQuery).toEqual({
      find: 'terms',
      field: 'field',
    });
  });

  it('should convert query to json on change', async () => {
    const props = {
      onChange: jest.fn(),
    };
    const { instance } = await setup(props);
    const query = { find: 'fields', type: 'keyword' };
    instance.onQueryChange(query, 'def');
    expect(props.onChange.mock.calls).toHaveLength(1);
    expect(props.onChange.mock.calls[0][0]).toBe(JSON.stringify(query));
    expect(props.onChange.mock.calls[0][1]).toBe('def');
  });
});
