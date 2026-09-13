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

  describe('in a secure context', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    });

    it('copies via the Clipboard API when clicked', async () => {
      render(<CopyIcon {...props} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(copySpy).toHaveBeenCalledWith(props.copyText);
    });
  });

  describe('in an insecure context', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
      document.execCommand = jest.fn();
    });

    it('falls back to execCommand and does not throw', async () => {
      render(<CopyIcon {...props} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(copySpy).not.toHaveBeenCalled();
    });

    it('restores focus to the previously active element after the fallback copy', async () => {
      render(<CopyIcon {...props} />);

      const button = screen.getByRole('button');
      const focusOrder: string[] = [];
      const recordFocus = (event: Event) => {
        focusOrder.push((event.target as HTMLElement).tagName);
      };
      document.addEventListener('focusin', recordFocus);

      await userEvent.click(button);

      document.removeEventListener('focusin', recordFocus);

      // The fallback textarea steals focus, so the last thing focused must be the button again,
      // otherwise the Tooltip closes on blur and the "Copied" state is never visible.
      expect(focusOrder).toContain('TEXTAREA');
      expect(focusOrder.at(-1)).toBe('BUTTON');
      expect(document.activeElement).toBe(button);
    });
  });
});
