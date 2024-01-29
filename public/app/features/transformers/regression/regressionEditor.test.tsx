import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldType, toDataFrame } from '@grafana/data';

import { ModelType } from './regression';
import { RegressionTransformerEditor } from './regressionEditor';

describe('FieldToConfigMappingEditor', () => {
  it('Should try to set the first time field as X and first number field as Y', async () => {
    const onChangeMock = jest.fn();

    const df = toDataFrame({
      name: 'data',
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
        { name: 'not this', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
        { name: 'value', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        { name: 'not this either', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
      ],
    });

    render(<RegressionTransformerEditor input={[df]} onChange={onChangeMock} options={{}} />);

    expect(onChangeMock).toBeCalledTimes(1);
    expect(onChangeMock).toBeCalledWith({ xFieldName: 'time', yFieldName: 'value' });
  });

  it('Should set the first field as X and the second as Y if there are no time fields', async () => {
    const onChangeMock = jest.fn();

    const df = toDataFrame({
      name: 'data',
      refId: 'A',
      fields: [
        { name: 'not this', type: FieldType.string, values: [0, 1, 2, 3, 4, 5] },
        { name: 'foo', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        { name: 'bar', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        { name: 'not this either', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
      ],
    });

    render(<RegressionTransformerEditor input={[df]} onChange={onChangeMock} options={{}} />);

    expect(onChangeMock).toBeCalledTimes(1);
    expect(onChangeMock).toBeCalledWith({ xFieldName: 'foo', yFieldName: 'bar' });
  });

  it('should display degree if the model is polynomial', async () => {
    const onChangeMock = jest.fn();

    const df = toDataFrame({
      name: 'data',
      refId: 'A',
      fields: [
        { name: 'foo', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        { name: 'bar', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
      ],
    });

    render(
      <RegressionTransformerEditor input={[df]} onChange={onChangeMock} options={{ modelType: ModelType.polynomial }} />
    );

    expect(await screen.findByText('Degree')).toBeInTheDocument();
  });

  it('should not display degree if the model is linear', async () => {
    const onChangeMock = jest.fn();

    const df = toDataFrame({
      name: 'data',
      refId: 'A',
      fields: [
        { name: 'foo', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        { name: 'bar', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
      ],
    });

    render(
      <RegressionTransformerEditor input={[df]} onChange={onChangeMock} options={{ modelType: ModelType.linear }} />
    );

    expect(await screen.queryByText('Degree')).not.toBeInTheDocument();
  });
});
