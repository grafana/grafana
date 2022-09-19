import React from 'react';

import { I18nProvider } from '../../app/core/internationalization';

const TestProvider = ({ children }: { children: React.ReactNode }) => {
  return <I18nProvider>{children}</I18nProvider>;
};

export default TestProvider;
