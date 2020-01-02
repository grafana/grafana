// Libraries
import React, { memo, useState, useEffect } from 'react';
import _ from 'lodash';

// Types
import { AbsoluteTimeRange, ExploreQueryFieldProps, ExploreMode } from '@grafana/data';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { useLokiSyntax } from './useLokiSyntax';
import { LokiExploreExtraField } from './LokiExploreExtraField';

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

  const [maxLines, setMaxLines] = useState(query?.maxLines.toString() || datasource.maxLines.toString());

  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider,
    absolute
  );

  function onChangeQueryLimit(value: string, override?: boolean) {
    const { query, onChange, onRunQuery } = props;
    if (onChange) {
      const nextQuery = { ...query, maxLines: +value };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  }

  useEffect(() => {
    onChangeQueryLimit(maxLines);
  }, [maxLines]);

  function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
    setMaxLines(e.currentTarget.value);
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
        ExtraFieldElement={LokiExploreExtraField}
        extraFieldProps={
          exploreMode === ExploreMode.Logs
            ? {
                label: 'Line limit',
                onChangeFunc: onMaxLinesChange,
                onKeyDownFunc: onReturnKeyDown,
                value: maxLines,
              }
            : null
        }
        {...syntaxProps}
      />
    </>
  );
});

export default LokiQueryEditor;
