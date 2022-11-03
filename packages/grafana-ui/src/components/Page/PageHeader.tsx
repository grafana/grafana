import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface PageHeaderProps {}

export function PageHeader({}: PageHeaderProps) {
  const styles = useStyles2(getStyles);

  return <h2>hello</h2>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {};
};
