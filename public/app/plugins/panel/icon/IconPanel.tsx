import React, { Component } from 'react';
import { PanelProps } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { ElementState } from 'app/features/canvas/runtime/element';
import { iconItem } from 'app/features/canvas/elements/icon';
import {
  ColorDimensionConfig,
  DimensionContext,
  getColorDimensionFromData,
  getResourceDimensionFromData,
  getScalarDimensionFromData,
  getScaleDimensionFromData,
  getTextDimensionFromData,
  ResourceDimensionConfig,
  ScalarDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';

interface Props extends PanelProps<PanelOptions> {}

export class IconPanel extends Component<Props> {
  private element: ElementState;

  constructor(props: Props) {
    super(props);
    this.element = this.initElement(props);
  }

  initElement = (props: Props) => {
    this.element = new ElementState(iconItem, props.options.root as any);
    this.updateSize(props);
    this.element.updateData(this.dims);
    return this.element;
  };

  updateSize = (props: Props) => {
    const { width, height } = props;
    this.element.anchor = {
      top: true,
      left: true,
    };
    this.element.placement = {
      left: 0,
      top: 0,
      width,
      height,
    };
    this.element.updateSize(width, height);
  };

  dims: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.props.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.props.data, scale),
    getScalar: (scalar: ScalarDimensionConfig) => getScalarDimensionFromData(this.props.data, scalar),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.props.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.props.data, res),
  };

  shouldComponentUpdate(nextProps: Props) {
    const { width, height, data } = this.props;
    let changed = false;

    if (width !== nextProps.width || height !== nextProps.height) {
      this.updateSize(nextProps);
      changed = true;
    }
    if (data !== nextProps.data) {
      this.element.updateData(this.dims);
      changed = true;
    }

    // Reload the element when options change
    if (this.props.options?.root !== nextProps.options?.root) {
      this.initElement(nextProps);
      changed = true;
    }
    return changed;
  }

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height, overflow: 'hidden', position: 'relative' }}>{this.element.render()}</div>;
  }
}
