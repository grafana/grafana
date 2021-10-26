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
  getScaleDimensionFromData,
  getTextDimensionFromData,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { CanvasElementOptions } from 'app/features/canvas';

interface Props extends PanelProps<PanelOptions> {}

export class IconPanel extends Component<Props> {
  private element: ElementState;

  constructor(props: Props) {
    super(props);
    this.element = this.initElement(props);
  }

  initElement = (props: Props) => {
    const canvasOptions: CanvasElementOptions = {
      ...props.options.root,
      anchor: {
        bottom: true,
        right: true,
        top: true,
        left: true,
      },
      placement: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      type: 'icon',
    };
    this.element = new ElementState(iconItem, canvasOptions, undefined, this.update);
    this.element.updateSize(props.width, props.height);
    this.element.updateData(this.dims);
    return this.element;
  };

  dims: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.props.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.props.data, scale),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.props.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.props.data, res),
  };

  shouldComponentUpdate(nextProps: Props) {
    const { width, height, data } = this.props;
    let changed = false;

    if (width !== nextProps.width || height !== nextProps.height) {
      this.element.updateSize(nextProps.width, nextProps.height);
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

  update = () => {
    this.forceUpdate();
  };

  render() {
    const { width, height } = this.props;
    return <div style={{ width, height, overflow: 'hidden', position: 'relative' }}>{this.element.render()}</div>;
  }
}
