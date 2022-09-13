// Copyright (c) 2019 Uber Technologies, Inc.
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

import { render, screen, within } from '@testing-library/react';
import React from 'react';

import AccordianText from './AccordianText';

const warnings = ['Duplicated tag', 'Duplicated spanId'];

describe('<AccordianText>', () => {
  const props = {
    compact: false,
    data: warnings,
    highContrast: false,
    isOpen: false,
    label: 'le-label',
    onToggle: jest.fn(),
  };

  it('renders without exploding', () => {
    render(<AccordianText {...props} />);
    expect(() => render(<AccordianText {...props} />)).not.toThrow();
  });

  it('renders the label', () => {
    render(<AccordianText {...props} />);
    const { getByText } = within(screen.getByTestId('AccordianText--header'));
    expect(getByText(props.label)).toBeInTheDocument();
  });

  it('renders the content when it is expanded', () => {
    props.isOpen = true;
    render(<AccordianText {...props} />);
    warnings.forEach((warning) => {
      expect(screen.getByText(warning)).toBeInTheDocument();
    });
  });
});
