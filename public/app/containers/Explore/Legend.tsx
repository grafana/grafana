import React, { PureComponent } from 'react';

const LegendItem = ({ series }) => (
  <div className="graph-legend-series">
    <div className="graph-legend-icon">
      <i className="fa fa-minus pointer" style={{ color: series.color }} />
    </div>
    <a className="graph-legend-alias pointer">{series.alias}</a>
  </div>
);

export default class Legend extends PureComponent<any, any> {
  render() {
    const { className = '', data } = this.props;
    const items = data || [];
    return (
      <div className={`${className} graph-legend ps`}>
        {items.map(series => <LegendItem key={series.id} series={series} />)}
      </div>
    );
  }
}
