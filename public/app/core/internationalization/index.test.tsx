import { render } from '@testing-library/react';
import React from 'react';

import { Trans } from './index';

describe('internationalization', () => {
  describe('Trans component', () => {
    it('should interpolate strings without escaping dangerous characters', () => {
      const name = '<script></script>';
      const { getByText } = render(<Trans i18nKey="explore.table.title-with-name">Table - {{ name }}</Trans>);

      expect(getByText('Table - <script></script>')).toBeInTheDocument();
    });

    it('should escape dangerous characters when shouldUnescape is false', () => {
      const name = '<script></script>';
      const { getByText } = render(
        <Trans i18nKey="explore.table.title-with-name" shouldUnescape={false}>
          Table - {{ name }}
        </Trans>
      );

      expect(getByText('Table - &lt;script&gt;&lt;&#x2F;script&gt;')).toBeInTheDocument();
    });
  });
});
