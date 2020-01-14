import React from 'react';
import renderer from 'react-test-renderer';
import { Stats } from './Stats';

const toOption = (value: any) => ({ label: value, value });

describe('Stats', () => {
  it('should render component', () => {
    const tree = renderer
      .create(
        <Stats
          values={['Average', 'Minimum']}
          variableOptionGroup={{ label: 'templateVar', value: 'templateVar' }}
          onChange={() => {}}
          stats={['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'].map(toOption)}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
