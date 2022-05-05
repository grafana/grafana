// Copyright (c) 2019 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { shallow } from 'enzyme';
import React from 'react';

import { Tooltip } from '@grafana/ui';

import traceGenerator from '../demo/trace-generators';
import transformTraceData from '../model/transform-trace-data';
import ReferenceLink from '../url/ReferenceLink';

import ReferencesButton, { getStyles } from './ReferencesButton';

describe(ReferencesButton, () => {
  const trace = transformTraceData(traceGenerator.trace({ numberOfSpans: 10 }));
  const oneReference = trace.spans[1].references;

  const moreReferences = oneReference.slice();
  const externalSpanID = 'extSpan';

  moreReferences.push(
    {
      refType: 'CHILD_OF',
      traceID: trace.traceID,
      spanID: trace.spans[2].spanID,
      span: trace.spans[2],
    },
    {
      refType: 'CHILD_OF',
      traceID: 'otherTrace',
      spanID: externalSpanID,
    }
  );

  const baseProps = {
    focusSpan: () => {},
  };

  it('renders single reference', () => {
    const props = { ...baseProps, references: oneReference };
    const wrapper = shallow(<ReferencesButton {...props} />);
    const refLink = wrapper.find(ReferenceLink);
    const tooltip = wrapper.find(Tooltip);
    const styles = getStyles();

    expect(refLink.length).toBe(1);
    expect(refLink.prop('reference')).toBe(oneReference[0]);
    expect(refLink.first().props().className).toBe(styles.MultiParent);
    expect(tooltip.length).toBe(1);
    expect(tooltip.prop('content')).toBe(props.tooltipText);
  });
});
