// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import Scrubber, { getStyles } from './Scrubber';

describe('<Scrubber>', () => {
  const defaultProps = {
    onMouseDown: sinon.spy(),
    position: 0,
  };

  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<Scrubber {...defaultProps} />);
  });

  it('contains the proper svg components', () => {
    const styles = getStyles();
    expect(
      wrapper.matchesElement(
        <g>
          <g className={styles.ScrubberHandles}>
            <rect className={styles.ScrubberHandleExpansion} />
            <rect className={styles.ScrubberHandle} />
          </g>
          <line className={styles.ScrubberLine} />
        </g>
      )
    ).toBeTruthy();
  });

  it('calculates the correct x% for a timestamp', () => {
    wrapper = shallow(<Scrubber {...defaultProps} position={0.5} />);
    const line = wrapper.find('line').first();
    const rect = wrapper.find('rect').first();
    expect(line.prop('x1')).toBe('50%');
    expect(line.prop('x2')).toBe('50%');
    expect(rect.prop('x')).toBe('50%');
  });

  it('supports onMouseDown', () => {
    const event = {};
    wrapper.find(`.${getStyles().ScrubberHandles}`).prop('onMouseDown')(event);
    expect(defaultProps.onMouseDown.calledWith(event)).toBeTruthy();
  });
});
