import React from 'react';

export class HeatmapCanvas extends React.Component<any> {
  canvas: HTMLCanvasElement | null = null;

  componentDidUpdate() {
    this.draw();
  }

  componentDidMount() {
    this.draw();
  }

  draw() {
    if (this.canvas === null) {
      return;
    }

    const { width, height, data } = this.props;

    if (!width || !height) {
      return;
    }

    const ctx = this.canvas.getContext('2d');
    console.log(this.props);
    // for (let i = 0; i < width; i++) {
    //   for (let j = 0; j < height; j++) {
    //     const colorJitter = Math.round(Math.random() * 100);
    //     ctx.fillStyle = `rgb(200,${colorJitter},0)`;
    //     ctx.fillRect(i, j, 1, 1);
    //   }
    // }
    const pointWidth = Math.floor(width / data.length);
    const pointHeight = Math.floor(height / data.length);
    console.log(pointWidth, pointHeight);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        ctx.fillStyle = `rgb(200,${value},0)`;
        ctx.fillRect(i * pointWidth, j * pointHeight, pointWidth, pointHeight);
      }
    }
  }

  render() {
    const { width, height } = this.props;
    return <canvas className="linkedin-heatmap-canvas" ref={e => (this.canvas = e)} width={width} height={height} />;
  }
}
