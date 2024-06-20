import { render } from '@testing-library/react';
import React from 'react';

import AttributeActionExtensionPoint from "./AttributeActionExtensionPoint";

describe('<AttributeActionExtensionPoint />', () => {
  const attribute = ({ key: 'key', value: 'value' });
  const attributes = [{ key: 'key', value: 'value' }];

  let copySpy: jest.SpyInstance;

  beforeAll(() => {
    copySpy = jest.spyOn(navigator.clipboard, 'writeText');
  });

  beforeEach(() => {
    copySpy.mockReset();
  });

  it('renders as expected', () => {
    expect(() => render(<AttributeActionExtensionPoint attribute={attribute} attributes={attributes} />)).not.toThrow();
  });
});
