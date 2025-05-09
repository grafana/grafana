import { ReactElement } from 'react';

import { Trans as TransCore, TransProps } from '@grafana/i18n';
import { t as tCore } from '@grafana/i18n/internal';

export const Trans = (props: TransProps): ReactElement => <TransCore {...props} />;

/**
 * This is a simple wrapper over i18n.t() to provide default namespaces and enforce a consistent API.
 * Note: Don't use this in the top level module scope. This wrapper needs initialization, which is done during Grafana
 * startup, and it will throw if used before.
 *
 * This will soon be deprecated in favor of useTranslate()
 * @param id ID of the translation string
 * @param defaultMessage Default message to use if the translation is missing
 * @param values Values to be interpolated into the string
 */
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) =>
  tCore(id, defaultMessage, values);
