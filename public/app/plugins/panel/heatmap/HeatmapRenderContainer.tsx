import React from 'react';
import HeatmapRenderer from './rendering';
import { HeatmapCtrl } from './heatmap_ctrl';

export class HeatmapRenderContainer extends React.Component {
  renderer: any;
  constructor(props) {
    super(props);
    this.renderer = HeatmapRenderer(
      this.props.scope,
      this.props.children[0],
      [],
      new HeatmapCtrl(this.props.scope, {}, {})
    );
  }

  render() {
    return <div />;
  }
}
