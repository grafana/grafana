import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createLokiDatasource } from '../../mocks';

import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';

describe('LokiQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const props = {
      query: {
        expr: '{job="testjob"}',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    render(<LokiQueryBuilderContainer {...props} />);
    const selector = await screen.findByLabelText('selector');
    expect(selector.textContent).toBe('{job="testjob"}');
    await addOperation('Range functions', 'Rate');
    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(props.onChange).toBeCalledWith({
      expr: 'rate({job="testjob"} [$__auto])',
      refId: 'A',
    });
  });
});

async function addOperation(section: string, op: string) {
  const addOperationButton = screen.getByTitle('Add operation');
  expect(addOperationButton).toBeInTheDocument();
  await userEvent.click(addOperationButton);
  const sectionItem = await screen.findByTitle(section);
  expect(sectionItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(sectionItem.children[0], { pointerEventsCheck: 0 });
  const opItem = screen.getByTitle(op);
  expect(opItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(opItem, { pointerEventsCheck: 0 });
}
