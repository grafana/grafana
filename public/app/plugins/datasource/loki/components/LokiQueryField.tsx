import React, { FunctionComponent } from 'react';
import { LokiQueryFieldForm, LokiQueryFieldFormProps } from './LokiQueryFieldForm';

type LokiQueryFieldProps = Omit<
  LokiQueryFieldFormProps,
  'labelsLoaded' | 'onLoadOptions' | 'onLabelsRefresh' | 'absoluteRange'
>;

export const LokiQueryField: FunctionComponent<LokiQueryFieldProps> = (props) => {
  const { datasource, range, ...otherProps } = props;
  const absoluteTimeRange = { from: range!.from!.valueOf(), to: range!.to!.valueOf() }; // Range here is never optional

  return <LokiQueryFieldForm datasource={datasource} absoluteRange={absoluteTimeRange} {...otherProps} />;
};

export default LokiQueryField;
