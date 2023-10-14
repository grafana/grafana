// Libraries
import React from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { dataTrailsApp } from './DataTrailsScene';

export interface Props extends GrafanaRouteComponentProps<{}> {}

export function DataTrailsPage({ match }: Props) {
  return <dataTrailsApp.Component model={dataTrailsApp} />;
}

export default DataTrailsPage;
