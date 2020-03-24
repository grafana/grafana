import React from 'react';

const Icon = (props: any) => {
  const { color, size, ...otherProps } = props;
  const secondColor = `${color}99`;

  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      ...otherProps,
    },
    React.createElement('path', {
      fill: secondColor,
      d:
        'M20.05713,22H3.94287A3.02288,3.02288,0,0,1,1.3252,17.46631L9.38232,3.51123a3.02272,3.02272,0,0,1,5.23536,0L22.6748,17.46631A3.02288,3.02288,0,0,1,20.05713,22Z',
    }),
    React.createElement('circle', {
      fill: color,
      cx: '12',
      cy: '17',
      r: '1',
    }),
    React.createElement('path', {
      fill: color,
      d: 'M12,14a1,1,0,0,1-1-1V9a1,1,0,0,1,2,0v4A1,1,0,0,1,12,14Z',
    })
  );
};

export default Icon;
