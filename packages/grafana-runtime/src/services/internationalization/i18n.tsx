// [@ckbedwell] hackathon project
// if you want to see this working look at the corresponding Synthetic Monitoring branch
// https://github.com/grafana/synthetic-monitoring-app/tree/hackathon/i18n-all-the-things

import { Trans as I18NextTrans } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { getTFunction } from '../../../../../public/app/core/internationalization';
import { NAMESPACES } from '../../../../../public/app/core/internationalization/constants';

export const SuccessfullySynced = () => {
  return 'You are successfully linked to your local grafana/grafana runtime';
};

// export the i18n methods as a service in this file

export const Trans: typeof I18NextTrans = (props) => {
  return <I18NextTrans shouldUnescape ns={NAMESPACES} {...props} />;
};

// Wrap t() to provide default namespaces and enforce a consistent API
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  const tFunc = getTFunction();

  if (!tFunc) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        't() was called before i18n was initialized. This is probably caused by calling t() in the root module scope, instead of lazily on render'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      throw new Error('t() was called before i18n was initialized');
    }
  }

  return tFunc(id, defaultMessage, values);
};
