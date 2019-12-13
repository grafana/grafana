// Libraries
import React, { memo, useState } from 'react';
import _ from 'lodash';

// Types
import { AbsoluteTimeRange, ExploreQueryFieldProps } from '@grafana/data';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { useLokiSyntax } from './useLokiSyntax';
import { FormLabel } from '@grafana/ui';

type Props = ExploreQueryFieldProps<LokiDatasource, LokiQuery, LokiOptions>;

export const LokiQueryEditor = memo(function LokiQueryEditor(props: Props) {
  const { query, data, datasource, exploreMode, history, onChange, onRunQuery } = props;

  let absolute: AbsoluteTimeRange;
  if (data && !_.isEmpty(data.request)) {
    const { range } = data.request;

    absolute = {
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };
  } else {
    absolute = {
      from: Date.now() - 10000,
      to: Date.now(),
    };
  }

  const [maxLines, setMaxLines] = useState('');

  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider,
    absolute
  );

  function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
    const maxLines = e.currentTarget.value;
    datasource.maxLines = isNaN(+maxLines) || +maxLines <= 0 ? 1000 : +maxLines;
    setMaxLines(maxLines);
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  return (
    <>
      <LokiQueryField
        datasource={datasource}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
        history={history}
        data={data}
        onLoadOptions={setActiveOption}
        onLabelsRefresh={refreshLabels}
        syntaxLoaded={isSyntaxReady}
        absoluteRange={absolute}
        {...syntaxProps}
      >
        {exploreMode === 'Logs' ? (
          <div className="gf-form-inline explore-input--ml">
            <div className="gf-form">
              <FormLabel width={6}>Line limit</FormLabel>
              <input
                type="text"
                className="gf-form-input width-6"
                placeholder={'auto'}
                onChange={onMaxLinesChange}
                onKeyDown={onReturnKeyDown}
                value={maxLines}
              />
            </div>
          </div>
        ) : null}
      </LokiQueryField>
    </>
  );
});

export default LokiQueryEditor;
