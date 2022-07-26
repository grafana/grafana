import React from 'react';
import { useAsync } from 'react-use';

import { ExplorePanelProps } from '@grafana/data';

import { getPanelForVisType } from './utils/panelsRegistry';

type Props = ExplorePanelProps & {
  visType: string;
};

export function Panel(props: Props) {
  const panelLoadState = useAsync(() => getPanelForVisType(props.visType), [props.visType]);
  if (panelLoadState.loading) {
    return null;
  }

  if (panelLoadState.error) {
    throw panelLoadState.error;
  }

  if (!panelLoadState.value) {
    // Should not happen if we are not loading or did not error out but makes TS happy
    return null;
  }

  const PanelInstance = panelLoadState.value;
  return <PanelInstance {...props} />;
}
