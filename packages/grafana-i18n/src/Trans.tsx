import { ReactElement } from 'react';
import { Trans as I18NextTrans } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { usePluginContext } from '@grafana/data';

import { getNamespaces } from './initializeI18n';
import { TransProps } from './types';

export const Trans = (props: TransProps): ReactElement => {
  const context = usePluginContext();

  // If we are in a plugin context, use the plugin's id as the namespace
  if (context?.meta?.id) {
    return <I18NextTrans shouldUnescape ns={context.meta.id} {...props} />;
  }

  return <I18NextTrans shouldUnescape ns={getNamespaces()} {...props} />;
};
