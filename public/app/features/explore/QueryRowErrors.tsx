import React, { FunctionComponent } from 'react';
import { ErrorContainer } from './ErrorContainer';
import { DataQueryError } from '@grafana/data';

export interface Props {
  queryErrors: DataQueryError[];
}

export const QueryRowErrors: FunctionComponent<Props> = (props: Props) => {
  const { queryErrors } = props;

  const errors = queryErrors.map(error => {
    return {
      ...error,
      refId: null,
    };
  });

  return <ErrorContainer queryErrors={errors} />;
};
