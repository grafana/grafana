import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectOptionInTest } from '@grafana/ui';
import { getSelectParent } from '@grafana/ui/src/components/Select/test-utils';

import { adHocBuilder } from '../shared/testing/builders';

import { AdHocVariableEditorUnConnected as AdHocVariableEditor } from './AdHocVariableEditor';

const props = {
  extended: {
    dataSources: [
      { text: 'Prometheus', value: null }, // default datasource
      { text: 'Loki', value: { type: 'loki-ds', uid: 'abc' } },
    ],
  },
  variable: adHocBuilder().withId('adhoc').withRootStateKey('key').withName('adhoc').build(),
  onPropChange: jest.fn(),

  // connected actions
  initAdHocVariableEditor: jest.fn(),
  changeVariableDatasource: jest.fn(),
};

describe('AdHocVariableEditor', () => {
  beforeEach(() => {
    props.changeVariableDatasource.mockReset();
  });

  it('has a datasource select menu', async () => {
    render(<AdHocVariableEditor {...props} />);

    const selectContainer = getSelectParent(screen.getByLabelText('Data source'));
    expect(selectContainer).toHaveTextContent('Prometheus');
  });

  it('calls the callback when changing the datasource', async () => {
    render(<AdHocVariableEditor {...props} />);
    await selectOptionInTest(screen.getByLabelText('Data source'), 'Loki');

    expect(props.changeVariableDatasource).toBeCalledWith(
      { type: 'adhoc', id: 'adhoc', rootStateKey: 'key' },
      { type: 'loki-ds', uid: 'abc' }
    );
  });

  it('renders informational text', () => {
    const extended = {
      ...props.extended,
      infoText: "Here's a message that should help you",
    };
    render(<AdHocVariableEditor {...props} extended={extended} />);

    const alert = screen.getByText("Here's a message that should help you");
    expect(alert).toBeInTheDocument();
  });
});
