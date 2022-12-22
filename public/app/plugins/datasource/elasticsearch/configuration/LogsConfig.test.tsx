import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';

describe('ElasticDetails', () => {
  it('should pass correct data to onChange', () => {
    const onChangeMock = jest.fn();
    const expectedMessageField = '@message';
    const expectedLevelField = '@level';

    render(<LogsConfig onChange={onChangeMock} value={createDefaultConfigOptions().jsonData} />);
    const messageField = screen.getByLabelText('Message field name');
    const levelField = screen.getByLabelText('Level field name');

    fireEvent.change(messageField, { target: { value: expectedMessageField } });
    expect(onChangeMock).toHaveBeenLastCalledWith(expect.objectContaining({ logMessageField: expectedMessageField }));

    fireEvent.change(levelField, { target: { value: expectedLevelField } });
    expect(onChangeMock).toHaveBeenLastCalledWith(expect.objectContaining({ logLevelField: expectedLevelField }));
  });
});
