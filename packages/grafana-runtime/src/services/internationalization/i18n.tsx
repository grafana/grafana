// [@ckbedwell] hackathon project
// if you want to see this working look at the corresponding Synthetic Monitoring branch
// https://github.com/grafana/synthetic-monitoring-app/tree/hackathon/i18n-all-the-things
import { Trans as I18NextTrans } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { getTFunction } from '../../../../../public/app/core/internationalization';

export const SuccessfullySynced = () => {
  return 'You are successfully linked to your local grafana/grafana runtime';
};

export const Trans: typeof I18NextTrans = (props) => {
  return <I18NextTrans shouldUnescape {...props} />;
};

// Wrap t() to provide default namespaces and enforce a consistent API
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  const tFunc = getTFunction();

  return tFunc(id, defaultMessage, values);
};
