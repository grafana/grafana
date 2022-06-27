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

import { render, screen } from '@testing-library/react';
import React from 'react';

import AccordianReferences, { References } from './AccordianReferences';

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

const link = { href: 'link' };

const setup = (propOverrides) => {
  const props = {
    compact: false,
    data: references,
    highContrast: false,
    isOpen: false,
    onToggle: jest.fn(),
    createFocusSpanLink: () => link,
    ...propOverrides,
  };

  return render(<AccordianReferences {...props} />);
};

describe('AccordianReferences tests', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('renders the correct number of references', () => {
    setup();

    expect(screen.getByRole('switch', { name: 'References (3)' })).toBeInTheDocument();
  });

  it('content doesnt show when not expanded', () => {
    setup({ isOpen: false });

    expect(screen.queryByRole('link', { name: /^View\sLinked/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /^service\d\sop\d/ })).toHaveLength(0);
  });

  it('renders the content when it is expanded', () => {
    setup({ isOpen: true });

    expect(screen.getByRole('switch', { name: 'References (3)' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^service\d\sop\d/ })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /^View\sLinked/ })).toBeInTheDocument();
  });
});
