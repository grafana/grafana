import React from 'react';
import { getColorFromHexRgbOrName } from '@grafana/ui/src/utils';

interface HeatmapCanvasProps {
  width: number;
  height: number;
  data: number[][];
  labels: string[];
  thresholds: any[];
  onPointHover?: (value: number, labels: string[]) => void;
  onPointClick?: (labels: string[]) => void;
}

export class HeatmapCanvas extends React.PureComponent<HeatmapCanvasProps> {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D;
  pointSize: number;

  componentDidUpdate() {
    this.draw();
  }

  componentDidMount() {
    this.draw();
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleMouseClick);
  }

  componentWillUnmount() {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleMouseClick);
  }

  handleMouseClick = event => {
    if (!this.ctx) {
      return;
    }
    console.log(event);
    if (event.ctrlKey) {
      return this.zoomCanvas(event);
    }
    if (event.shiftKey) {
      return this.resetZoom();
    }
    const x = event.layerX;
    const y = event.layerY;
    const pointLabels = this.getPointLabels(x, y);
    const pointValue = this.getPointValue(x, y);
    if (this.props.onPointHover && pointValue !== null) {
      this.props.onPointClick(pointLabels);
    }
  };

  handleMouseMove = event => {
    if (!this.ctx) {
      return;
    }
    const x = event.layerX;
    const y = event.layerY;
    // const pixel = this.ctx.getImageData(x, y, 1, 1);
    // console.log(pixel);
    // const pixelData = pixel.data;
    const pointLabels = this.getPointLabels(x, y);
    const pointValue = this.getPointValue(x, y);
    // console.log(pointLabels, pointValue);

    if (this.props.onPointHover) {
      this.props.onPointHover(pointValue, pointLabels);
    }
  };

  getPointLabels(x: number, y: number): string[] {
    const xIndex = Math.floor(x / this.pointSize);
    const yIndex = Math.floor(y / this.pointSize);
    return [this.props.labels[xIndex], this.props.labels[yIndex]];
  }

  getPointValue(x: number, y: number): number {
    const xIndex = Math.floor(x / this.pointSize);
    const yIndex = Math.floor(y / this.pointSize);
    if (xIndex >= this.props.data.length || yIndex >= this.props.data.length) {
      return null;
    }
    return this.props.data[yIndex][xIndex];
  }

  zoomCanvas(event) {
    const { width, height } = this.props;
    const x = event.layerX;
    const y = event.layerY;
    // this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.translate(-x, -y);
    this.ctx.scale(2, 2);
    this.draw();
    // this.ctx.restore();
  }

  resetZoom() {
    const { width, height } = this.props;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.draw();
  }

  valueToColor = (value: number) => {
    const thresholds = this.props.thresholds;
    let color = getColorFromHexRgbOrName(thresholds[0].color);
    for (const threshold of thresholds) {
      if (value > threshold.value) {
        color = getColorFromHexRgbOrName(threshold.color);
      }
    }
    return color;
  };

  draw() {
    if (this.canvas === null) {
      return;
    }

    const { width, height, data } = this.props;

    if (!width || !height || !data) {
      return;
    }

    console.log('drawing canvas');
    console.log(this.props);
    const ctx = this.canvas.getContext('2d');
    this.ctx = ctx;
    const pointWidth = Math.max(Math.floor(width / data.length), 1);
    const pointHeight = Math.max(Math.floor(height / data.length), 1);
    const pointSize = Math.min(pointWidth, pointHeight);
    this.pointSize = pointSize;
    // console.log(pointWidth, pointHeight);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        ctx.fillStyle = this.valueToColor(value);
        ctx.fillRect(i * pointSize, j * pointSize, pointSize, pointSize);
      }
    }
  }

  render() {
    console.log('rendering canvas component');
    const { width, height } = this.props;
    return <canvas className="linkedin-heatmap-canvas" ref={e => (this.canvas = e)} width={width} height={height} />;
  }
}
