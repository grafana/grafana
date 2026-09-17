import { css } from '@emotion/css';
import { lazy, memo, Suspense } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

export interface QueryInputProps {
  /** Current query text. */
  value: string;
  /** Called whenever the query text changes. */
  onChange: (value: string) => void;
  /** Called when the user presses Shift+Enter or Ctrl+Enter. */
  onRunQuery?: () => void;
  /** Called when the input loses focus. */
  onBlur?: () => void;
  /** Placeholder shown while the input is empty. */
  placeholder?: string;
  /** Accessible label applied to the query input. */
  'aria-label'?: string;
  /** Accessible label reference applied to the query input. */
  'aria-labelledby'?: string;
}

const QueryInputImplementation = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-query-input" */ './QueryInputImplementation').then((module) => ({
    default: module.QueryInputImplementation,
  }))
);

const styles = {
  wrapper: css({
    width: '100%',
  }),
};

/**
 * A controlled query input backed by CodeMirror. Long queries wrap, plain Enter
 * inserts a newline, and Shift+Enter or Ctrl+Enter runs the query when
 * `onRunQuery` is provided.
 */
export const QueryInput = memo(function QueryInput(props: QueryInputProps) {
  return (
    <div className={styles.wrapper} data-testid={selectors.components.QueryField.container}>
      <Suspense fallback={<LoadingPlaceholder text={t('grafana-ui.query-input.loading', 'Loading editor')} />}>
        <QueryInputImplementation {...props} />
      </Suspense>
    </div>
  );
});
