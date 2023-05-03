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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import CopyIcon from './CopyIcon';

Object.assign(navigator, {
  clipboard: {
    writeText: () => {},
  },
});

describe('<CopyIcon />', () => {
  const props = {
    className: 'classNameValue',
    copyText: 'copyTextValue',
    tooltipTitle: 'tooltipTitleValue',
  };
  let copySpy: jest.SpyInstance;

  beforeAll(() => {
    copySpy = jest.spyOn(navigator.clipboard, 'writeText');
  });

  beforeEach(() => {
    copySpy.mockReset();
  });

  it('renders as expected', () => {
    expect(() => render(<CopyIcon {...props} />)).not.toThrow();
  });

  it('copies when clicked', async () => {
    render(<CopyIcon {...props} />);

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(copySpy).toHaveBeenCalledWith(props.copyText);
  });
});
