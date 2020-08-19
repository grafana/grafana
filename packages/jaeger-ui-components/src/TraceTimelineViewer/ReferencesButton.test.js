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

import React from 'react';
import { shallow } from 'enzyme';

import ReferencesButton, { getStyles } from './ReferencesButton';
import transformTraceData from '../model/transform-trace-data';
import traceGenerator from '../demo/trace-generators';
import ReferenceLink from '../url/ReferenceLink';
import { UIDropdown, UIMenuItem, UITooltip } from '../uiElementsContext';

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
    const dropdown = wrapper.find(UIDropdown);
    const refLink = wrapper.find(ReferenceLink);
    const tooltip = wrapper.find(UITooltip);
    const styles = getStyles();

    expect(dropdown.length).toBe(0);
    expect(refLink.length).toBe(1);
    expect(refLink.prop('reference')).toBe(oneReference[0]);
    expect(refLink.first().props().className).toBe(styles.MultiParent);
    expect(tooltip.length).toBe(1);
    expect(tooltip.prop('title')).toBe(props.tooltipText);
  });

  it('renders multiple references', () => {
    const props = { ...baseProps, references: moreReferences };
    const wrapper = shallow(<ReferencesButton {...props} />);
    const dropdown = wrapper.find(UIDropdown);
    expect(dropdown.length).toBe(1);
    // We have some wrappers here that dynamically inject specific component so we need to traverse a bit
    // here
    const menuInstance = shallow(
      shallow(dropdown.first().props().overlay).prop('children')({
        Menu: ({ children }) => <div>{children}</div>,
      })
    );
    const submenuItems = menuInstance.find(UIMenuItem);
    expect(submenuItems.length).toBe(3);
    submenuItems.forEach((submenuItem, i) => {
      expect(submenuItem.find(ReferenceLink).prop('reference')).toBe(moreReferences[i]);
    });
    expect(
      submenuItems
        .at(2)
        .find(ReferenceLink)
        .childAt(0)
        .text()
    ).toBe(`(another trace) - ${moreReferences[2].spanID}`);
  });
});
