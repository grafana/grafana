import React, { Component, ComponentClass } from 'react';
import _ from 'lodash';

export interface Props {
  type: string;
  queries: Query[];
}

interface State {
  isLoading: boolean;
  timeSeries: TimeSeriesServerResponse[];
}

export interface OriginalProps {
  data: TimeSeriesServerResponse[];
  isLoading: boolean;
}

const DataPanel = (ComposedComponent: ComponentClass<OriginalProps & Props>) => {
  class Wrapper extends Component<Props, State> {}

  return Wrapper;
};
