import React from 'react';
import { GraphiteQueryEditorState } from '../state/store';
import { TagsSection } from './TagsSection';
import { MetricsSection } from './MetricsSection';

type Props = {
  state: GraphiteQueryEditorState;
};

export function SeriesSection({ state }: Props) {
  const section = state.queryModel?.seriesByTagUsed ? (
    <TagsSection tags={state.queryModel?.tags} addTagSegments={state.addTagSegments} state={state} />
  ) : (
    <MetricsSection segments={state.segments} state={state} />
  );

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <label className="gf-form-label width-6 query-keyword">Series</label>
      </div>
      {section}
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
}
