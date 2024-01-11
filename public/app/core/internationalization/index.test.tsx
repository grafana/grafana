import { render } from '@testing-library/react';
import React from 'react';

import { Trans } from './index';

describe('internationalization', () => {
  describe('Trans component', () => {
    it('should interpolate strings without escaping dangerous characters', () => {
      const label='<script></script>'
      const { getByText } = render(
          <Trans>{{label}}</Trans>
      );
  
      expect(getByText('<script></script>')).toBeInTheDocument();
    });

    it('should escape dangerous characters when shouldUnescape is false', () => {
      const label='<script></script>'
      const { getByText } = render(
          <Trans shouldUnescape={false}>{{label}}</Trans>
      );
  
      expect(getByText('&lt;script&gt;&lt;&#x2F;script&gt;')).toBeInTheDocument();
    });
  });
})
