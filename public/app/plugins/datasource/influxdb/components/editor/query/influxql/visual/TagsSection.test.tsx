import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { InfluxQueryTag } from '../../../../../types';

import { TagsSection } from './TagsSection';

function getTagKeys() {
  return Promise.resolve(['t1', 't2', 't3', 't4', 't5', 't6']);
}

function getTagValuesForKey(key: string) {
  const data = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((v) => `${key}_${v}`);
  return Promise.resolve(data);
}

function assertText(tags: InfluxQueryTag[], textResult: string) {
  const { container } = render(
    <TagsSection
      tags={tags}
      getTagKeyOptions={getTagKeys}
      getTagValueOptions={getTagValuesForKey}
      onChange={() => null}
    />
  );
  expect(container.textContent).toBe(textResult);
}

async function assertSegmentSelect(
  segmentText: string,
  optionText: string,
  callback: () => void,
  callbackValue: unknown
) {
  // we find the segment
  const segs = screen.getAllByRole('button', { name: segmentText });
  expect(segs.length).toBe(1);
  const seg = segs[0];
  expect(seg).toBeInTheDocument();

  act(() => {
    fireEvent.click(seg);
  });

  // find the option and click it
  const option = await screen.findByText(optionText, { selector: 'span' });
  expect(option).toBeInTheDocument();
  act(() => {
    fireEvent.click(option);
  });

  await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

  expect(callback).toHaveBeenCalledWith(callbackValue);
}

const tags: InfluxQueryTag[] = [
  {
    key: 't1',
    value: 't1_v1',
    operator: '=',
  },
  {
    condition: 'AND',
    key: 't2',
    value: 't2_v2',
    operator: '!=',
  },
  {
    condition: 'OR',
    key: 't3',
    value: 't3_v3',
    operator: '<>',
  },
];

describe('InfluxDB InfluxQL Editor tags section', () => {
  it('should display correct data', () => {
    assertText(tags, 't1=t1_v1ANDt2!=t2_v2ORt3<>t3_v3+');
  });
  it('should handle incorrect data', () => {
    const incorrectTags: InfluxQueryTag[] = [
      {
        condition: 'OR', // extra unused condition
        key: 't1',
        value: 't1_v1',
        operator: '=',
      },
      {
        // missing `condition`
        key: 't2',
        value: 't2_v2',
        operator: '!=',
      },
      {
        condition: 'OR',
        key: 't3',
        value: 't3_v3',
        // missing `operator, string-value
      },
      {
        condition: 'OR',
        key: 't4',
        value: '/t4_v4/',
        // missing `operator, regex-value
      },
      {
        condition: 'XOR', // invalid `condition`
        key: 't5',
        value: 't5_v5',
        operator: 'haha', // invalid `operator`
      },
    ];

    assertText(incorrectTags, 't1=t1_v1ANDt2!=t2_v2ORt3=t3_v3ORt4=~/t4_v4/XORt5hahat5_v5+');
  });

  it('should handle adding a new tag check', async () => {
    const onChange = jest.fn();

    render(
      <TagsSection
        tags={tags}
        getTagKeyOptions={getTagKeys}
        getTagValueOptions={getTagValuesForKey}
        onChange={onChange}
      />
    );

    await assertSegmentSelect('+', 't5', onChange, [
      ...tags,
      {
        key: 't5',
        value: 'select tag value',
        operator: '=',
        condition: 'AND',
      },
    ]);
  });
  it('should handle changing the tag-condition', async () => {
    const onChange = jest.fn();

    render(
      <TagsSection
        tags={tags}
        getTagKeyOptions={getTagKeys}
        getTagValueOptions={getTagValuesForKey}
        onChange={onChange}
      />
    );

    const newTags = [...tags];
    newTags[1] = { ...newTags[1], condition: 'OR' };

    await assertSegmentSelect('AND', 'OR', onChange, newTags);
  });
  it('should handle changing the tag-key', async () => {
    const onChange = jest.fn();

    render(
      <TagsSection
        tags={tags}
        getTagKeyOptions={getTagKeys}
        getTagValueOptions={getTagValuesForKey}
        onChange={onChange}
      />
    );

    const newTags = [...tags];
    newTags[1] = { ...newTags[1], key: 't5' };

    await assertSegmentSelect('t2', 't5', onChange, newTags);
  });
  it('should handle changing the tag-operator', async () => {
    const onChange = jest.fn();

    render(
      <TagsSection
        tags={tags}
        getTagKeyOptions={getTagKeys}
        getTagValueOptions={getTagValuesForKey}
        onChange={onChange}
      />
    );

    const newTags = [...tags];
    newTags[2] = { ...newTags[2], operator: '<' };

    await assertSegmentSelect('<>', '<', onChange, newTags);
  });
  it('should handle changing the tag-value', async () => {
    const onChange = jest.fn();

    render(
      <TagsSection
        tags={tags}
        getTagKeyOptions={getTagKeys}
        getTagValueOptions={getTagValuesForKey}
        onChange={onChange}
      />
    );

    const newTags = [...tags];
    newTags[0] = { ...newTags[0], value: 't1_v5' };

    await assertSegmentSelect('t1_v1', 't1_v5', onChange, newTags);
  });
});
