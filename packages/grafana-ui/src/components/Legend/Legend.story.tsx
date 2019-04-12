// import React from 'react';
// // import { storiesOf } from '@storybook/react';
// import { LegendList } from './LegendList';
// import { Legend, LegendItem, LegendPlacement } from './Legend';
// import tinycolor from 'tinycolor2';
// import { DisplayValue } from '../../types/index';
// import { number, select, text } from '@storybook/addon-knobs';
// import { GraphLegendItem } from '../Graph/GraphLegendItem';
// import { action } from '@storybook/addon-actions';

import { LegendItem } from './Legend';
import tinycolor from 'tinycolor2';
import { DisplayValue } from '../../types/index';

export const generateLegendItems = (numberOfSeries: number, statsToDisplay?: DisplayValue[]): LegendItem[] => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  return [...new Array(numberOfSeries)].map((item, i) => {
    return {
      label: `${alphabet[i].toUpperCase()}-series`,
      color: tinycolor.fromRatio({ h: i / alphabet.length, s: 1, v: 1 }).toHexString(),
      isVisible: true,
      useRightYAxis: false,
      info: statsToDisplay || [],
    };
  });
};

// const getStoriesKnobs = () => {
//   const numberOfSeries = number('Number of series', 3);
//   const containerWidth = select(
//     'Container width',
//     {
//       Small: '200px',
//       Medium: '500px',
//       'Full width': '100%',
//     },
//     '100%'
//   );

//   const rawRenderer = (item: LegendItem) => (
//     <>
//       Label: <strong>{item.label}</strong>, Color: <strong>{item.color}</strong>, isVisible:{' '}
//       <strong>{item.isVisible ? 'yes' : 'no'}</strong>
//     </>
//   );

//   const customRenderer = (item: LegendItem) => (
//     <GraphLegendItem
//       item={item}
//       onLabelClick={action('GraphLegendItem label clicked')}
//       onSeriesColorChange={action('Series color changed')}
//       onToggleAxis={action('Y-axis toggle')}
//     />
//   );

//   const legendItemRenderer = select(
//     'Item rendered',
//     {
//       'Raw renderer': 'raw',
//       'Custom renderer(GraphLegenditem)': 'custom',
//     },
//     'raw'
//   );

//   const rightAxisSeries = text('Right y-axis series, i.e. A,C', '');

//   const legendPlacement = select<LegendPlacement>(
//     'Legend placement',
//     {
//       under: 'under',
//       right: 'right',
//     },
//     'under'
//   );

//   return {
//     numberOfSeries,
//     containerWidth,
//     itemRenderer: legendItemRenderer === 'raw' ? rawRenderer : customRenderer,
//     rightAxisSeries,
//     legendPlacement,
//   };
// };

// const LegendStories = storiesOf('UI/Legend/Legend', module);

// LegendStories.add('list', () => {
//   const { numberOfSeries, itemRenderer, containerWidth, rightAxisSeries, legendPlacement } = getStoriesKnobs();
//   let items = generateLegendItems(numberOfSeries);

//   items = items.map(i => {
//     if (
//       rightAxisSeries
//         .split(',')
//         .map(s => s.trim())
//         .indexOf(i.label.split('-')[0]) > -1
//     ) {
//       i.useRightYAxis = true;
//     }

//     return i;
//   });
//   return (
//     <div style={{ width: containerWidth }}>
//       <Legend itemRenderer={itemRenderer} renderLegendAs={LegendList} items={items} placement={legendPlacement} />
//     </div>
//   );
// });

// LegendStories.add('table', () => {
//   return <h1>TODO</h1>;
// });
