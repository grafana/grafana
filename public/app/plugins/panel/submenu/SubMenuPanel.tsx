// Libraries
import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
// Utils
import { SubMenu } from 'app/features/dashboard/components/SubMenu/SubMenu';
// Types
import { SubMenuOptions } from './types';

interface Props extends PanelProps<SubMenuOptions> {}

export class SubMenuPanel extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { query, hideVariables, hideAnnotations, hideLinks } = this.props.options;
    return (
      <SubMenu query={query} hideVariables={hideVariables} hideAnnotations={hideAnnotations} hideLinks={hideLinks} />
    );
  }
}
