// Copyright (c) 2017 Uber Technologies, Inc.
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

import CopyIcon from '../../common/CopyIcon';
import { ubInlineBlock } from '../../uberUtilityStyles';

import KeyValuesTable, { LinkValue } from './KeyValuesTable';

describe('LinkValue', () => {
  const title = 'titleValue';
  const href = 'hrefValue';
  const childrenText = 'childrenTextValue';
  const wrapper = shallow(
    <LinkValue href={href} title={title}>
      {childrenText}
    </LinkValue>
  );

  it('renders as expected', () => {
    expect(wrapper.find('a').prop('href')).toBe(href);
    expect(wrapper.find('a').prop('title')).toBe(title);
    expect(wrapper.find('a').text()).toMatch(/childrenText/);
  });
});

describe('<KeyValuesTable>', () => {
  let wrapper;

  const data = [
    { key: 'span.kind', value: 'client' },
    { key: 'omg', value: 'mos-def' },
    { key: 'numericString', value: '12345678901234567890' },
    { key: 'jsonkey', value: JSON.stringify({ hello: 'world' }) },
  ];

  beforeEach(() => {
    wrapper = shallow(<KeyValuesTable data={data} />);
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.find('[data-test-id="KeyValueTable"]').length).toBe(1);
  });

  it('renders a table row for each data element', () => {
    const trs = wrapper.find('tr');
    expect(trs.length).toBe(data.length);
    trs.forEach((tr, i) => {
      expect(tr.find('[data-test-id="KeyValueTable--keyColumn"]').text()).toMatch(data[i].key);
    });
  });

  it('renders a single link correctly', () => {
    wrapper.setProps({
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                url: `http://example.com/?kind=${encodeURIComponent(array[i].value)}`,
                text: `More info about ${array[i].value}`,
              },
            ]
          : [],
    });

    const anchor = wrapper.find(LinkValue);
    expect(anchor).toHaveLength(1);
    expect(anchor.prop('href')).toBe('http://example.com/?kind=client');
    expect(anchor.prop('title')).toBe('More info about client');
    expect(anchor.closest('tr').find('td').first().text()).toBe('span.kind');
  });

  it('renders a <CopyIcon /> with correct copyText for each data element', () => {
    const copyIcons = wrapper.find(CopyIcon);
    expect(copyIcons.length).toBe(data.length);
    copyIcons.forEach((copyIcon, i) => {
      expect(copyIcon.prop('copyText')).toBe(JSON.stringify(data[i], null, 2));
      expect(copyIcon.prop('tooltipTitle')).toBe('Copy JSON');
    });
  });

  it('renders a span value containing numeric string correctly', () => {
    const el = wrapper.find(`.${ubInlineBlock}`);
    expect(el.length).toBe(data.length);
    el.forEach((valueDiv, i) => {
      if (data[i].key !== 'jsonkey') {
        expect(valueDiv.html()).toMatch(`"${data[i].value}"`);
      }
    });
  });

  it('properly escapes values', () => {
    const data = [
      {
        key: 'jsonkey',
        value: JSON.stringify({
          '<img src=x onerror=alert(1)>': '<img src=x onerror=alert(1)>',
          url: 'https://example.com"id=x tabindex=1 onfocus=alert(1)',
        }),
      },
    ];
    const wrapper = shallow(<KeyValuesTable data={data} />);
    const el = wrapper.find(`.${ubInlineBlock}`);
    expect(el.length).toBe(1);
    expect(el.html().replace(/\n/g, '')).toMatch(
      `<div class=\"css-7kp13n\"><div class=\"json-markup\">{    <span class=\"json-markup-key\">\"&lt;img src=x onerror=alert(1)&gt;\":</span> <span class=\"json-markup-string\">\"&lt;img src=x onerror=alert(1)&gt;\"</span>,    <span class=\"json-markup-key\">\"url\":</span> <span class=\"json-markup-string\">\"<a href=\"https://example.com%22id=x%20tabindex=1%20onfocus=alert(1)\">https://example.com&quot;id=x tabindex=1 onfocus=alert(1)</a>\"</span>}</div></div>`
    );
  });
});
