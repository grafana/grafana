import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { Provider } from 'react-redux';
import { type Store } from 'redux';

import { initialVariableEditorState } from '../editor/reducer';
import { getPreloadedState } from '../state/helpers';

import { DataSourceVariableEditor } from './DataSourceVariableEditor';
import { initialDataSourceVariableModelState } from './reducer';

const variable = { ...initialDataSourceVariableModelState, rootStateKey: 'foo' };

const editorExtended = {
  dataSourceTypes: [
    { text: 'Prometheus', value: 'ds-prom' },
    { text: 'Loki', value: 'ds-loki' },
  ],
};

function createMockStore() {
  const dispatch = jest.fn();
  const subscribe = jest.fn();
  const templatingState = {
    variables: {
      [variable.id]: { ...variable },
    },
    editor: {
      ...initialVariableEditorState,
      extended: editorExtended,
    },
  };
  const getState = jest.fn().mockReturnValue(getPreloadedState('foo', templatingState));
  return { getState, dispatch, subscribe } as unknown as Store;
}

function renderWithStore(jsx: JSX.Element) {
  const store = createMockStore();
  return {
    user: userEvent.setup(),
    ...render(<Provider store={store}>{jsx}</Provider>),
  };
}

const onPropChange = jest.fn();

describe('DataSourceVariableEditor', () => {
  beforeEach(() => {
    onPropChange.mockReset();
  });

  it('has a data source select menu', () => {
    renderWithStore(<DataSourceVariableEditor variable={variable} onPropChange={onPropChange} />);

    const selectContainer = screen.getByLabelText('Type');
    expect(selectContainer).toBeInTheDocument();
  });

  it('calls the handler when the data source is changed', async () => {
    const { user } = renderWithStore(<DataSourceVariableEditor variable={variable} onPropChange={onPropChange} />);

    // Open the select and pick Loki
    const select = screen.getByLabelText('Type');
    await user.click(select);
    await user.click(screen.getByText('Loki'));

    expect(onPropChange).toBeCalledWith({ propName: 'query', propValue: 'ds-loki', updateOptions: true });
  });

  it('has a regex filter field', () => {
    renderWithStore(<DataSourceVariableEditor variable={variable} onPropChange={onPropChange} />);
    const field = screen.getByLabelText(/Instance name filter/);
    expect(field).toBeInTheDocument();
  });

  it('calls the handler when the regex filter is changed in onBlur', async () => {
    const { user } = renderWithStore(<DataSourceVariableEditor variable={variable} onPropChange={onPropChange} />);
    const field = screen.getByLabelText(/Instance name filter/);
    await user.click(field);
    await user.type(field, '/prod/');
    expect(field).toHaveValue('/prod/');
    await user.tab();
    expect(onPropChange).toHaveBeenCalledWith({ propName: 'regex', propValue: '/prod/', updateOptions: true });
  });
});
