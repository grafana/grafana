// Copyright (c) 2019 The Jaeger Authors.
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
import AccordianReferences, { References } from './AccordianReferences';
import ReferenceLink from '../../url/ReferenceLink';

const traceID = 'trace1';
const references = [
  {
    refType: 'CHILD_OF',
    span: {
      spanID: 'span1',
      traceID,
      operationName: 'op1',
      process: {
        serviceName: 'service1',
      },
    },
    spanID: 'span1',
    traceID,
  },
  {
    refType: 'CHILD_OF',
    span: {
      spanID: 'span3',
      traceID,
      operationName: 'op2',
      process: {
        serviceName: 'service2',
      },
    },
    spanID: 'span3',
    traceID,
  },
  {
    refType: 'CHILD_OF',
    spanID: 'span5',
    traceID: 'trace2',
  },
];

describe('<AccordianReferences>', () => {
  let wrapper;

  const props = {
    compact: false,
    data: references,
    highContrast: false,
    isOpen: false,
    onToggle: jest.fn(),
    focusSpan: jest.fn(),
  };

  beforeEach(() => {
    wrapper = shallow(<AccordianReferences {...props} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the content when it is expanded', () => {
    wrapper.setProps({ isOpen: true });
    const content = wrapper.find(References);
    expect(content.length).toBe(1);
    expect(content.prop('data')).toBe(references);
  });
});

describe('<References>', () => {
  let wrapper;

  const props = {
    data: references,
    focusSpan: jest.fn(),
  };

  beforeEach(() => {
    wrapper = shallow(<References {...props} />);
  });

  it('render references list', () => {
    const refLinks = wrapper.find(ReferenceLink);
    expect(refLinks.length).toBe(references.length);
    refLinks.forEach((refLink, i) => {
      const span = references[i].span;
      const serviceName = refLink.find('span.span-svc-name').text();
      if (span && span.traceID === traceID) {
        const endpointName = refLink.find('small.endpoint-name').text();
        expect(serviceName).toBe(span.process.serviceName);
        expect(endpointName).toBe(span.operationName);
      } else {
        expect(serviceName).toBe('< span in another trace >');
      }
    });
  });
});
