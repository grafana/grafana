import { render, screen } from '@testing-library/react';
import React from 'react';

import OpenTsDatasource from '../datasource';
import { OpenTsdbQuery } from '../types';

import { OpenTsdbQueryEditor, OpenTsdbQueryEditorProps, testIds } from './OpenTsdbQueryEditor';

const setup = (propOverrides?: Object) => {
  const getAggregators = jest.fn().mockResolvedValue([]);
  const getFilterTypes = jest.fn().mockResolvedValue([]);

  const datasourceMock: unknown = {
    getAggregators,
    getFilterTypes,
    tsdbVersion: 1,
  };

  const datasource: OpenTsDatasource = datasourceMock as OpenTsDatasource;
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: OpenTsdbQuery = { metric: '', refId: 'A' };
  const props: OpenTsdbQueryEditorProps = {
    datasource: datasource,
    onRunQuery: onRunQuery,
    onChange: onChange,
    query,
  };

  Object.assign(props, propOverrides);

  return render(<OpenTsdbQueryEditor {...props} />);
};
describe('OpenTsdbQueryEditor', () => {
  it('should render editor', () => {
    setup();
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
  });
});
