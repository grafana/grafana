import React from 'react';

import { I18nProvider } from '../../app/core/internationalization';

const TestProvider: React.FC = ({ children }) => {
  return <I18nProvider>{children}</I18nProvider>;
};

export default TestProvider;
